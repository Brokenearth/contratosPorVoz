import { describe, expect, it } from "vitest";
import { DEMO_PHRASES, runPipeline } from "../../../src/core/pipeline";

/** Collapses the nesting-marker stack trace into its distinct consecutive states. */
function markerHistory(steps: { stack: string[] }[]): string[] {
  const history: string[] = [];
  for (const step of steps) {
    const view = step.stack.join(" ");
    if (history[history.length - 1] !== view) history.push(view);
  }
  return history;
}

describe("runPipeline with the real lexer", () => {
  it("§6 example → exact CLÁUSULA SEGUNDA", () => {
    const result = runPipeline(
      "arriendo lote La Esperanza de 5 hectáreas para 20 vacas de raza holstein para producción de leche por 12 meses",
      {},
      { force: true },
    );
    expect(result.errors).toEqual([]);
    expect(result.fields).toEqual({
      lote: "La Esperanza",
      hectareas: 5,
      animales: [{ cantidad: 20, animal: "vacas", raza: "holstein" }],
      uso: "producción de leche",
      duracion: { cantidad: 12, unidad: "meses" },
    });
    expect(result.template?.id).toBe("PASTOREO");
    expect(result.missing).toEqual(["fecha", "valor"]);
    expect(result.contract?.output).toContain(
      "CLÁUSULA SEGUNDA. El ARRENDATARIO podrá mantener en el lote La Esperanza (5 hectáreas) un máximo de 20 vacas de raza Holstein, destinadas exclusivamente a la producción de leche, durante 12 meses.",
    );
  });

  it("does not generate the contract while required fields are missing", () => {
    expect(runPipeline("arriendo lote La Esperanza para 20 vacas").contract).toBeNull();
  });

  it("§5.5 three orders give identical fields", () => {
    const phrases = [
      "arriendo el lote 20 para 20 toros gir por 30 días",
      "los 20 toros gir se arriendan en el lote 20 por 30 días",
      "por 30 días, lote 20, 20 toros gir",
    ];
    for (const phrase of phrases) {
      const result = runPipeline(phrase);
      expect(result.errors).toEqual([]);
      expect(result.fields).toEqual({
        lote: "20",
        animales: [{ cantidad: 20, animal: "toros", raza: "gir" }],
        duracion: { cantidad: 30, unidad: "días" },
      });
    }
  });

  it("§5.2 nested animals push and pop SUB", () => {
    const result = runPipeline("20 vacas de raza holstein de los cuales 5 terneras fin y 3 caballos");
    expect(result.parse.ok).toBe(true);
    expect(markerHistory(result.parse.trace)).toEqual(["Z0", "Z0 SUB", "Z0"]);
    expect(result.parse.trace.at(-1)?.action).toBe("ACEPTA");
    expect(result.fields.animales).toEqual([
      { cantidad: 20, animal: "vacas", raza: "holstein", sub: [{ cantidad: 5, animal: "terneras" }] },
      { cantidad: 3, animal: "caballos" },
    ]);
  });

  it("§5.6 dialog asks for what is missing and merges the answer", () => {
    const first = runPipeline(
      "20 vacas holstein en el lote 7 de 5 hectáreas por 6 meses por un valor de 2 millones de pesos",
    );
    expect(first.errors).toEqual([]);
    expect(first.template?.id).toBe("PASTOREO");
    expect(first.missing).toEqual(["fecha", "uso"]);
    expect(first.question).toBe("Falta la fecha y para qué se usará el lote.");
    expect(first.contract).toBeNull();

    const second = runPipeline("desde el 15 de noviembre para ganadería de leche", first.fields);
    expect(second.errors).toEqual([]);
    expect(second.missing).toEqual([]);
    expect(second.question).toBe("");
    expect(second.fields).toMatchObject({ lote: "7", uso: "ganadería de leche", fecha: { dia: 15, mes: 11 } });
    expect(second.contract?.accepted).toBe(true);
    expect(second.contract?.output).toContain("$ 2.000.000 pesos");
    expect(second.contract?.output).not.toContain("{{");
  });

  it("selects CULTIVO for a crop dictation", () => {
    const result = runPipeline(
      "arriendo el lote El Porvenir de 3 hectáreas para cultivo de maíz desde el 1 de diciembre de 2026 por 6 meses por un valor de 2 millones de pesos, los insumos los aporta el arrendatario",
    );
    expect(result.errors).toEqual([]);
    expect(result.fields).toMatchObject({
      lote: "El Porvenir",
      hectareas: 3,
      cultivo: "maíz",
      insumos: "arrendatario",
      fecha: { dia: 1, mes: 12, anio: 2026 },
      valor: { monto: 2_000_000, moneda: "pesos" },
    });
    expect(result.template?.id).toBe("CULTIVO");
    expect(result.missing).toEqual([]);
    expect(result.contract?.output).toContain("exclusivamente al cultivo de maíz");
  });

  it("selects MIXTA for livestock plus crop", () => {
    const result = runPipeline(
      "arriendo el lote 4 de 10 hectáreas para 15 vacas de raza gir para ganadería de leche y para cultivo de maíz por 1 año desde el 1 de marzo de 2027 por un valor de 8 millones de pesos, los insumos los aporta el arrendador",
    );
    expect(result.errors).toEqual([]);
    expect(result.fields.uso).toBe("ganadería de leche");
    expect(result.template?.id).toBe("MIXTA");
    expect(result.missing).toEqual([]);
    expect(result.contract?.output).toContain("cultivo de maíz");
  });

  it("reads number words, 'mil' and accents", () => {
    const result = runPipeline("Arriendo el lote dos por TRES MESES por un valor de 900 mil pesos");
    expect(result.errors).toEqual([]);
    expect(result.fields).toEqual({
      lote: "2",
      duracion: { cantidad: 3, unidad: "meses" },
      valor: { monto: 900_000, moneda: "pesos" },
    });
  });

  it("reports clear errors on garbage input without crashing", () => {
    const result = runPipeline("@@ hola mundo #");
    expect(result.parse.ok).toBe(true);
    expect(result.errors).toContain("Símbolo desconocido '@' en la posición 0.");
    expect(result.errors.some((e) => e.includes("Se ignoró 'hola'"))).toBe(true);
    expect(result.template).toBeNull();
    expect(result.contract).toBeNull();
    expect(result.question).toContain("No se reconoció");
  });

  it("handles the empty input", () => {
    const result = runPipeline("");
    expect(result.errors).toEqual([]);
    expect(result.contract).toBeNull();
  });

  it.each(DEMO_PHRASES)("demo phrase parses and generates a contract: %s", (phrase) => {
    const result = runPipeline(phrase);
    expect(result.errors).toEqual([]);
    expect(result.missing).toEqual([]);
    expect(result.contract?.accepted).toBe(true);
  });

  it("demo phrases cover the three templates", () => {
    const ids = new Set(DEMO_PHRASES.map((p) => runPipeline(p).template?.id));
    expect(ids).toEqual(new Set(["PASTOREO", "CULTIVO", "MIXTA"]));
  });
});

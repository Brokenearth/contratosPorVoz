import { describe, expect, it } from "vitest";
import { DEMO_PHRASES, runPipeline } from "../../../src/core/pipeline";
import { getTemplate } from "../../../src/core/templates";

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
  it("preserves cattle categories, local area units and the scale of the amount", () => {
    const result = runPipeline(
      "alquilamos lote 20 de 8 fanegadas para 3 vacunos de raza Holstein Friesian " +
        "para engorde por dos quincenas desde el 2 de setiembre valor 900 mil pesos COP",
    );
    expect(result.errors).toEqual([]);
    expect(result.fields).toMatchObject({
      animales: [{ animal: "bovinos", cantidad: 3, raza: "holstein" }],
      areaLocal: { cantidad: 8, unidad: "fanegada" },
      valor: { monto: 900_000, moneda: "pesos" },
      fecha: { dia: 2, mes: 9 },
      duracion: { cantidad: 2, unidad: "quincenas" },
    });
    expect(result.fields.hectareas).toBeUndefined();
    expect(result.contract?.output).toContain("8 fanegadas");
    expect(result.contract?.output).toContain("3 bovinos");
    expect(runPipeline("lote 20 de 8 ha").fields.hectareas).toBe(8);
    expect(runPipeline("lote 0020 para sembrar fríjol e insumos los aporta el arrendador").fields).toMatchObject({
      lote: "0020", cultivo: "frijol", insumos: "arrendador",
    });
  });

  it("suggests a breed with the original span only in an explicit breed context", () => {
    const input = "20 vacas de raza holsten";
    const result = runPipeline(input);
    expect(result.contract).toBeNull();
    expect(result.suggestions).toEqual([
      { original: "holsten", start: input.indexOf("holsten"), end: input.length, candidates: [{ value: "holstein", distance: 1 }] },
    ]);
    for (const protectedInput of [
      "arrendador nombre Ana Holsten", "lote El Holsten", "arrendatario Ana Gómez",
      "20 vacas de raza gr", "lote 20 de 8 fanegdas", "valor 6 milloness",
    ]) expect(runPipeline(protectedInput).suggestions).toEqual([]);
  });

  it("retains the rejected filling trace without offering its partial output as a contract", () => {
    const template = getTemplate("PASTOREO");
    const original = template.body;
    try {
      template.body = "Hola {{raza";
      const result = runPipeline(DEMO_PHRASES[0]!);
      expect(result.fill?.accepted).toBe(false);
      expect(result.contract).toBeNull();
      expect(result.errors).toContainEqual(expect.stringContaining("sin transición"));
    } finally {
      template.body = original;
    }
  });

  it.each([
    ["lote 20, vacas, para ceba", "PASTOREO"],
    ["lote 20 para cultivo de maíz", "CULTIVO"],
    ["lote 20, vacas, para ceba y para cultivo de maíz", "MIXTA"],
  ])("generates a complete draft from required fields only for %s", (input, id) => {
    const result = runPipeline(`${input} desde el 3 de marzo valor 900 mil pesos`);
    expect(result.template?.id).toBe(id);
    expect(result.missing).toEqual([]);
    expect(result.contract?.accepted).toBe(true);
    expect(result.contract?.output).not.toMatch(/\{\{|\[\[|con una extensión de|de raza |durante \d|serán aportados por/);
  });

  it("marks a forced draft incomplete and leaves the required date visible", () => {
    const result = runPipeline("lote 20 para cultivo de maíz valor 900 mil pesos", {}, { force: true });
    expect(result.missing).toEqual(["fecha"]);
    expect(result.contract?.output).toContain("Borrador incompleto");
    expect(result.contract?.output).toContain("{{fecha}}");
  });

  it.each(["desde el 31 de febrero", "por 0 meses", "valor 0 pesos"])(
    "does not publish a draft with an invalid field (%s)",
    (invalid) => {
      const result = runPipeline(`lote 20 para cultivo de maíz ${invalid}`, {}, { force: true });
      expect(result.blocked).toBe(true);
      expect(result.contract).toBeNull();
    },
  );

  it.each(["fin", "@"])("never regenerates a draft on a rejected turn (%s)", (input) => {
    const previous = runPipeline(DEMO_PHRASES[0]!).fields;
    const result = runPipeline(input, previous, { force: true });
    expect(result.fields).toEqual(previous);
    expect(result.contract).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("asks for the use when only common fields are present", () => {
    const result = runPipeline("lote 20 valor 900 mil pesos");
    expect(result.template).toBeNull();
    expect(result.selection.run.output).toContain("RESULT:-:0:1");
    expect(result.question).toMatch(/animales.*cultivo/);
  });

  it("keeps both nested levels and the next sibling in the generated Markdown", () => {
    const input = DEMO_PHRASES[2]!.replace("5 terneras fin", "5 terneras de los cuales 2 terneras fin fin");
    const result = runPipeline(input);
    const nested = result.parse.trace.find((step) => step.stack.length === 3);
    expect(nested?.symbols.filter((symbol) => symbol === '"fin"')).toHaveLength(2);
    expect(result.fields.animales?.[0]?.sub?.[0]?.sub?.[0]?.cantidad).toBe(2);
    expect(result.fields.animales?.[1]?.animal).toBe("caballos");
    expect(result.contract?.output).toContain("(de los cuales 5 terneras (de los cuales 2 terneras)) y 3 caballos");
    for (const malformed of [input.replace("fin fin", "fin"), input.replace("fin fin", "fin fin fin")]) {
      const rejected = runPipeline(malformed, result.fields, { force: true });
      expect(rejected.parse.ok).toBe(false);
      expect(rejected.contract).toBeNull();
    }
  });

  it.each([
    ["Arrendador nombre Juan de la Cruz", { arrendador: "Juan de la Cruz" }],
    ["arrendataria nombre Ana Gómez", { arrendatario: "Ana Gómez" }],
    ["arrendador Juan Pérez", { arrendador: "Juan Pérez" }],
    ["la arrendadora María José del Río", { arrendador: "María José del Río" }],
    ["Arrendador nombre Luis Toro", { arrendador: "Luis Toro" }],
    ["arrendador Luz Dueña", { arrendador: "Luz Dueña" }],
  ])("extracts the complete party name from %s", (phrase, expected) => {
    const result = runPipeline(phrase);
    expect(result.errors).toEqual([]);
    expect(result.fields).toEqual(expected);
  });

  it("asks for review instead of assigning conflicting names for the same role", () => {
    const result = runPipeline("arrendador nombre Juan Pérez y arrendador nombre Luis Toro");
    expect(result.fields.arrendador).toBeUndefined();
    expect(result.errors).toContainEqual(expect.stringContaining("Confirme el correcto"));
  });

  it("keeps the supplier separate from the parties and closes names at the next clause", () => {
    const result = runPipeline(
      "arrendadora nombre María José de la Cruz lote 20 para 20 toros " +
        "la arrendataria aporta los insumos y arrendataria nombre Ana Gómez",
    );
    expect(result.errors).toEqual([]);
    expect(result.fields).toEqual({
      arrendador: "María José de la Cruz",
      arrendatario: "Ana Gómez",
      insumos: "arrendatario",
      lote: "20",
      animales: [{ animal: "toros", cantidad: 20 }],
    });
  });

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
    expect(result.question).toContain("Símbolo desconocido");
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

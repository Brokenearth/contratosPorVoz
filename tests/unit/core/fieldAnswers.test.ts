import { describe, expect, it } from "vitest";
import { composeFieldAnswers, missingOptional } from "../../../src/core/fieldAnswers";
import { runPipeline } from "../../../src/core/pipeline";
import { getTemplate } from "../../../src/core/templates";

const cultivo = runPipeline("lote 20 para cultivo de maíz");
const pastoreo = runPipeline("arriendo lote La Esperanza para vacas para producción de leche desde el 15 de noviembre de 2026");

describe("individual boxes for missing fields", () => {
  it("lists the missing required and optional fields of the template", () => {
    expect(cultivo.missing).toEqual(["fecha", "valor"]);
    expect(cultivo.missingOptional).toEqual(["hectareas", "insumos", "duracion"]);
    expect(pastoreo.missing).toEqual(["valor"]);
    expect(pastoreo.missingOptional).toEqual(["hectareas", "cantidad_animales", "raza", "duracion"]);
  });

  it("does not offer count or breed boxes for a list of several animals", () => {
    const list = runPipeline("lote 7 para 20 vacas y 3 caballos");
    expect(missingOptional(list.fields, getTemplate("PASTOREO"))).not.toContain("raza");
  });

  it("adds the keyword that opens each clause and completes the contract through the pipeline", () => {
    const { text, errors } = composeFieldAnswers(
      { fecha: "1 de diciembre de 2026", valor: "2 millones", hectareas: "3", duracion: "6 meses", insumos: "arrendatario" },
      cultivo.fields,
    );
    expect(errors).toEqual({});
    expect(text).toBe(
      "lote 20 de 3 hectáreas, desde el 1 de diciembre de 2026, por 6 meses, por un valor de 2 millones, " +
        "los insumos los aporta el arrendatario",
    );
    const answered = runPipeline(text, cultivo.fields);
    expect(answered.missing).toEqual([]);
    expect(answered.missingOptional).toEqual([]);
    expect(answered.contract?.output).toContain("$ 2.000.000 pesos");
    expect(answered.contract?.output).toContain("3 hectáreas");
    expect(answered.contract?.output).not.toContain("{{");
  });

  it("keeps a full phrase typed in a box and accepts plain amounts", () => {
    const { text, errors } = composeFieldAnswers({ fecha: "desde el 2 de enero", valor: "900.000" }, cultivo.fields);
    expect(errors).toEqual({});
    expect(text).toBe("desde el 2 de enero, por un valor de 900.000 pesos");
  });

  it("completes the single animal with its count and breed, repairing the spelling in context", () => {
    const { text, errors } = composeFieldAnswers(
      { cantidad_animales: "veinte", raza: "holste", valor: "6 millones de pesos" },
      pastoreo.fields,
    );
    expect(errors).toEqual({});
    const answered = runPipeline(text, pastoreo.fields);
    expect(answered.fields.animales).toEqual([{ animal: "vacas", cantidad: 20, raza: "holstein" }]);
    expect(answered.contract?.output).toContain("un máximo de 20 vacas de raza Holstein");
  });

  it("reports an error per box without composing the rejected clause", () => {
    const { text, errors } = composeFieldAnswers(
      { fecha: "31 de febrero", valor: "mucho dinero", cantidad_animales: "muchas", lote: "fin" },
      pastoreo.fields,
    );
    expect(errors).toEqual({
      fecha: "Indique una fecha válida del calendario.",
      valor: "No se reconoció el valor del arrendamiento.",
      cantidad_animales: "Escriba solo la cantidad de animales, por ejemplo 20.",
      lote: "No se reconoció el número o nombre del lote.",
    });
    expect(text).toBe("");
  });

  it("asks to choose between close spellings", () => {
    const { errors } = composeFieldAnswers({ raza: "norolando" }, pastoreo.fields);
    expect(errors.raza).toBe("«norolando» puede ser normando o girolando. Escriba la palabra que corresponde.");
  });

  it("needs the lot or the animal before their dependent boxes", () => {
    const empty = {};
    expect(composeFieldAnswers({ hectareas: "5" }, empty).errors.hectareas).toBe("Indique primero el lote.");
    expect(composeFieldAnswers({ raza: "gir" }, empty).errors.raza).toBe("Indique primero el tipo de animal.");
    const together = composeFieldAnswers({ lote: "7", hectareas: "5 fanegadas", tipo_animal: "toros", raza: "gir" }, empty);
    expect(together).toEqual({ text: "lote 7 de 5 fanegadas, toros de raza gir", errors: {} });
  });

  it("does not let a box change other data of the contract", () => {
    const scope = "Escriba solo el valor del arrendamiento; los demás datos van en su propio cuadro.";
    expect(composeFieldAnswers({ valor: "2 millones y lote 9" }, cultivo.fields).errors.valor).toBe(scope);
    expect(composeFieldAnswers({ fecha: "1 de enero por un valor de 9 millones" }, cultivo.fields).errors.fecha).toBe(
      "Escriba solo la fecha; los demás datos van en su propio cuadro.",
    );
    const crop = composeFieldAnswers({ cultivo: "cultivo de frijol" }, runPipeline("lote 3 para vacas").fields);
    expect(crop).toEqual({ text: "para cultivo de frijol", errors: {} });
  });

  it("keeps the typed words so the pipeline reports its spelling corrections", () => {
    const { text } = composeFieldAnswers({ raza: "holste" }, pastoreo.fields);
    expect(text).toBe("vacas de raza holste");
    expect(runPipeline(text, pastoreo.fields).corrections).toEqual([
      expect.objectContaining({ original: "holste", value: "holstein" }),
    ]);
  });
});

import { describe, expect, it } from "vitest";
import { fillTemplate } from "../turing/fill";
import { extractedFieldNames, formatMoney, toValueMap, contractValues } from "./format";
import { getTemplate, parseTemplate, TEMPLATES } from "./index";
import type { ContractFields } from "../types";

const exampleFields: ContractFields = {
  lote: "La Esperanza",
  hectareas: 5,
  animales: [{ cantidad: 20, animal: "vaca", raza: "holstein" }],
  uso: "leche",
  duracion: { cantidad: 12, unidad: "meses" },
};

describe("parseTemplate", () => {
  it("reads the declaration block", () => {
    const def = parseTemplate(
      "---\nid: CULTIVO\ntitulo: Cultivo\nrequeridos: lote, cultivo\nopcionales: fecha\n---\nCuerpo",
    );
    expect(def).toEqual({
      id: "CULTIVO",
      title: "Cultivo",
      required: ["lote", "cultivo"],
      optional: ["fecha"],
      body: "Cuerpo",
    });
  });

  it("rejects a template without declaration", () => {
    expect(() => parseTemplate("sin bloque")).toThrow();
  });
});

describe("TEMPLATES", () => {
  it("loads the three templates with their required fields", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["PASTOREO", "CULTIVO", "MIXTA"]);
    expect(getTemplate("PASTOREO").required).toContain("tipo_animal");
    expect(getTemplate("CULTIVO").required).toContain("insumos");
  });

  it.each(TEMPLATES)("$id contains the fixed clauses and the draft legend", (template) => {
    for (const text of [
      "Objeto",
      "Duración",
      "Precio y forma de pago",
      "Obligaciones del ARRENDADOR",
      "Obligaciones del ARRENDATARIO",
      "Terminación",
      "Resolución de conflictos",
      "FIRMAS",
      "no reemplaza",
    ]) {
      expect(template.body).toContain(text);
    }
  });

  it.each(TEMPLATES)("$id fills completely when every field is given", (template) => {
    const values = toValueMap({
      ...exampleFields,
      cultivo: "maíz",
      insumos: "arrendador",
      fecha: { dia: 15, mes: 11, anio: 2026 },
      valor: { monto: 1200000, moneda: "pesos" },
      arrendador: "Pedro Gómez",
      arrendatario: "Luis Pérez",
    });
    const result = fillTemplate(template.body, values);
    expect(result.run.accepted).toBe(true);
    expect(result.pending).toEqual([]);
    for (const leftover of ["{{", "}}", "[[", "]]"]) expect(result.run.output).not.toContain(leftover);
    expect(result.run.output).toContain("Pedro Gómez");
  });

  it.each(TEMPLATES)("$id uses every declared field as a marker", (template) => {
    for (const field of [...template.required, ...template.optional]) expect(template.body).toContain(`{{${field}}}`);
  });
});

describe("toValueMap", () => {
  it("formats the §6 example values", () => {
    const values = toValueMap({
      ...exampleFields,
      fecha: { dia: 15, mes: 11, anio: 2026 },
      valor: { monto: 1200000, moneda: "pesos" },
    });
    expect(values).toMatchObject({
      lote: "La Esperanza",
      hectareas: "5 hectáreas",
      cantidad_animales: "20",
      tipo_animal: "vacas",
      raza: "Holstein",
      uso: "producción de leche",
      duracion: "12 meses",
      fecha: "15 de noviembre de 2026",
      valor: "$ 1.200.000 pesos",
      destinados: "destinadas",
    });
  });

  it("describes animal lists with sub-items", () => {
    const values = toValueMap({
      animales: [
        { cantidad: 20, animal: "vacas", raza: "gir", sub: [{ cantidad: 5, animal: "terneras" }] },
        { cantidad: 2, animal: "toro", raza: "brahman" },
      ],
    });
    expect(values.cantidad_animales).toBe("22");
    expect(values.tipo_animal).toBe("animales");
    expect(values.raza).toBe("Gir y Brahman");
    expect(values.destinados).toBe("destinados");
    expect(values.animales_descripcion).toBe(
      "20 vacas de raza Gir (de los cuales 5 terneras) y 2 toros de raza Brahman",
    );
  });

  it("uses singular units and converts millions", () => {
    const values = toValueMap({
      hectareas: 1,
      duracion: { cantidad: 1, unidad: "años" },
      valor: { monto: 2.5, moneda: "millones" },
    });
    expect(values).toMatchObject({ hectareas: "1 hectárea", duracion: "1 año", valor: "$ 2.500.000 pesos" });
  });

  it("names who supplies the inputs", () => {
    expect(toValueMap({ insumos: "arrendatario" }).insumos).toBe("el ARRENDATARIO");
  });

  it("lists only the data field names for selection", () => {
    expect(extractedFieldNames(exampleFields).sort()).toEqual(
      ["cantidad_animales", "duracion", "hectareas", "lote", "raza", "tipo_animal", "uso"].sort(),
    );
  });

  it("formats money with thousands separators", () => {
    expect(formatMoney(950)).toBe("$ 950 pesos");
  });
});

describe("§6 example end to end", () => {
  it("produces the CLÁUSULA SEGUNDA of the proposal", () => {
    const result = fillTemplate(getTemplate("PASTOREO").body, contractValues(exampleFields));
    expect(result.run.accepted).toBe(true);
    expect(result.run.output).toContain(
      "CLÁUSULA SEGUNDA. El ARRENDATARIO podrá mantener en el lote La Esperanza (5 hectáreas) un máximo de 20 vacas de raza Holstein, destinadas exclusivamente a la producción de leche, durante 12 meses.",
    );
    expect(result.pending).toEqual(["valor"]);
    expect(result.run.output).not.toContain("[[");
  });
});

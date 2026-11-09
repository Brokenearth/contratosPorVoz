import { describe, expect, it } from "vitest";
import { fillTemplate, templateToTape } from "../../../../src/core/turing/fill";
import { stateFamily } from "../../../../src/core/turing/machine";

describe("templateToTape", () => {
  it("keeps markers as single cells", () => {
    expect(templateToTape("a{{b}}[[?c]]d[[/c]]")).toEqual([
      "a",
      "{{",
      "b",
      "}}",
      "[[?",
      "c",
      "]]",
      "d",
      "[[/",
      "c",
      "]]",
      "⊣",
    ]);
  });
});

describe("fillTemplate", () => {
  it("replaces every marker with its value", () => {
    const result = fillTemplate("Hola {{nombre}}, lote {{lote}}.", { nombre: "Ana", lote: "La Esperanza" });
    expect(result.run.accepted).toBe(true);
    expect(result.run.output).toBe("Hola Ana, lote La Esperanza.");
    expect(result.pending).toEqual([]);
  });

  it("keeps a marker pending when its value is missing", () => {
    const result = fillTemplate("Valor: {{valor}} por {{duracion}}", { duracion: "12 meses" });
    expect(result.run.accepted).toBe(true);
    expect(result.run.output).toBe("Valor: {{valor}} por 12 meses");
    expect(result.pending).toEqual(["valor"]);
  });

  it("removes an optional section when its field is absent", () => {
    const result = fillTemplate("A.[[?fecha]] Desde el {{fecha}}.[[/fecha]] B.", {});
    expect(result.run.output).toBe("A. B.");
  });

  it("keeps an optional section, without its markers, when the field is present", () => {
    const result = fillTemplate("A.[[?fecha]] Desde el {{fecha}}.[[/fecha]] B.", { fecha: "15 de noviembre" });
    expect(result.run.output).toBe("A. Desde el 15 de noviembre. B.");
  });

  it("goes through the five named states", () => {
    const result = fillTemplate("x {{a}} y", { a: "1" });
    const families = new Set(result.run.snapshots.map((s) => stateFamily(s.state)));
    for (const name of ["q_buscar", "q_leer", "q_borrar", "q_escribir", "q_fin"]) expect(families).toContain(name);
  });

  it("stops at maxSteps without accepting", () => {
    const result = fillTemplate("texto largo {{a}} con muchas letras", { a: "1" }, { maxSteps: 5 });
    expect(result.run.accepted).toBe(false);
    expect(result.run.steps).toBe(5);
  });
});

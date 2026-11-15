import { describe, expect, it } from "vitest";
import { runPipeline } from "../../../src/core/pipeline";

const contract = "lote 20 para cultivo de maíz desde el 2 de marzo de 2027 valor 900 mil pesos";

describe("revisión de quién aporta los insumos", () => {
  it.each([
    "el arrendador aporta los insumos y el arrendatario también",
    "el arrendatario aporta los insumos y la arrendadora también",
    "los insumos los aporta el arrendatario y el dueño",
    "el arrendador aporta los insumos y el arrendatario también aporta los insumos",
    "los insumos los aporta la dueña y la arrendataria",
  ])("pide aclaración en lugar de asignar un solo proveedor o inventar nombres (%s)", (supplies) => {
    const result = runPipeline(`${contract}, ${supplies}`);

    expect(result.blocked).toBe(true);
    expect(result.question).toMatch(/insumos/i);
    expect(result.contract).toBeNull();
    expect(result.fields.arrendador).toBeUndefined();
    expect(result.fields.arrendatario).toBeUndefined();
  });

  it.each([
    ["el arrendador aporta los insumos", "arrendador", "ARRENDADOR"],
    ["los insumos los aporta la arrendataria", "arrendatario", "ARRENDATARIO"],
  ])("conserva a un proveedor inequívoco (%s)", (supplies, supplier, printedRole) => {
    const result = runPipeline(`${contract}, ${supplies}`);

    expect(result.fields.insumos).toBe(supplier);
    expect(result.contract?.output).toContain(`serán aportados por el ${printedRole}`);
  });

  it("conserva el nombre de la otra parte en una cláusula de identificación", () => {
    const result = runPipeline(
      `${contract}, el arrendador aporta los insumos y la arrendataria Ana Gómez`,
    );

    expect(result.fields.insumos).toBe("arrendador");
    expect(result.fields.arrendatario).toBe("Ana Gómez");
    expect(result.contract?.output).toContain("y Ana Gómez, mayor de edad");
  });

  it("pide aclarar una continuación sin obligación anterior", () => {
    const result = runPipeline(contract + ", el arrendatario también");
    expect(result.question).toMatch(/obligación.*también/);
    expect(result.fields.arrendatario).toBeUndefined();
    expect(result.contract).toBeNull();
  });

  it.each(["Ana También", "También"])("conserva un nombre indicado explícitamente (%s)", (name) => {
    const result = runPipeline(contract + ", arrendataria nombre " + name);
    expect(result.fields.arrendatario).toBe(name);
    expect(result.contract?.output).toContain(name);
  });
});

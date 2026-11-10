import { describe, expect, it } from "vitest";
import { runPipeline } from "../../../src/core/pipeline";

describe("contextual spelling repair", () => {
  it.each(["milones", "mellones"])("repairs %s only in an amount", (typo) => {
    const result = runPipeline(`lote 20 para cultivo de maíz desde el 2 de marzo valor 2 ${typo} de pesos`);
    expect(result.fields.valor).toEqual({ monto: 2_000_000, moneda: "pesos" });
    expect(result.contract?.output).toContain("$ 2.000.000 pesos");
  });

  it("repairs an animal and then a breed exposed by that repair", () => {
    const result = runPipeline("lote 20 para 4 baca de raza holste para ceba desde el 2 de marzo valor 900 mil pesos");
    expect(result.fields.animales).toEqual([{ animal: "vaca", raza: "holstein", cantidad: 4 }]);
    expect(result.contract?.output).toContain("4 vacas de raza Holstein");
  });

  it("uses livestock vocabulary for bombino", () => {
    const result = runPipeline("20 bombino para ceba");
    expect(result.fields.animales?.[0]?.animal).toBe("bovino");
    expect(result.suggestions.flatMap(({ candidates }) => candidates)).not.toContainEqual(expect.objectContaining({ value: "bombillo" }));
  });

  it("keeps plausible alternatives pending", () => {
    const result = runPipeline("20 vacas de raza norolando");
    expect(result.suggestions[0]?.candidates.map(({ value }) => value)).toEqual(["normando", "girolando"]);
    expect(result.contract).toBeNull();
  });

  it("asks before choosing between plausible monetary scales", () => {
    const result = runPipeline("lote 20 para cultivo de maíz desde el 2 de marzo valor 2 mill de pesos");
    expect(result.suggestions[0]?.candidates.map(({ value }) => value)).toEqual(["mil", "millón"]);
    expect(result.corrections).toEqual([]);
    expect(result.contract).toBeNull();
  });

  it("protects names, lot identifiers and area units", () => {
    const result = runPipeline("lote El Holste para cultivo de maíz, arrendador nombre Luz Baca");
    expect(result.fields).toMatchObject({ lote: "El Holste", arrendador: "Luz Baca" });
    expect(result.suggestions).toEqual([]);
    const area = runPipeline("lote 20 de 8 baca");
    expect(area.blocked).toBe(true);
    expect(area.suggestions).toEqual([]);
  });
});

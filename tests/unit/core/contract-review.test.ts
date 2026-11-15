import { describe, expect, it } from "vitest";
import { runPipeline } from "../../../src/core/pipeline";

const crop = "lote 20 para cultivo de maíz desde el 2 de marzo de 2027";
const pastoreo = "lote 20 para ceba desde el 2 de marzo de 2027 valor 900 mil pesos";
const cropContract = crop + " valor 900 mil pesos";

function expectReview(input: string, field: RegExp) {
  const result = runPipeline(input, {}, { force: true });
  expect(result.blocked).toBe(true);
  expect(result.contract).toBeNull();
  expect(result.question).toMatch(field);
}

describe("revisión de datos del contrato", () => {
  it.each([
    "2 millones de dólares",
    "2 millones USD",
    "900 mil pesos mensuales por 6 meses",
    "900 mil a un millón de pesos",
  ])("pide precisar el valor antes de generar cuando la entrada contiene %s", (value) => {
    expectReview(crop + " valor " + value, /valor|pago|moneda|canon|importe/i);
  });

  it.each([
    "2 pesos y 900 mil pesos",
    "2 millones y medio de pesos",
    "dos millones quinientos mil pesos",
    "2 mil quinientos pesos",
  ])("pide volver a escribir el importe completo cuando se dicta %s", (value) => {
    expectReview(crop + " valor " + value, /valor/i);
  });

  it("conserva la cantidad de ganado dictada como veinticinco", () => {
    const result = runPipeline(pastoreo + " para veinticinco vacas");
    expect(result.fields.animales?.[0]?.cantidad).toBe(25);
    expect(result.contract?.output).toContain("25 vacas");
  });

  it.each([
    [" por 1 año y 6 meses", /duraci[oó]n|plazo/i],
    [" por 6 meses renovables", /duraci[oó]n|plazo|renova/i],
    [" por 2 meses por 3 meses", /duraci[oó]n|plazo/i],
    [" lote 99", /lote/i],
    [" valor 1 millón de pesos", /valor|monto|canon/i],
    [" para cultivo de café", /cultivo/i],
    [" desde el 3 de abril", /fecha|inicio/i],
    [" el arrendador aporta los insumos el arrendatario aporta los insumos", /insumos|aport/i],
  ])("pide aclarar %s antes de generar", (suffix, field) => {
    expectReview(cropContract + suffix, field);
  });

  it("pide aclarar el lote en lugar de transferirle el área de otro", () => {
    expectReview("lote 20 de 8 hectáreas lote 21 para cultivo de maíz desde el 2 de marzo valor 900 mil pesos", /lote/i);
  });

  it("pide aclarar el área cuando se dan dos extensiones del mismo lote", () => {
    expectReview("lote 20 de 8 hectáreas lote 20 de 3 fanegadas para cultivo de maíz desde el 2 de marzo valor 900 mil pesos", /[áa]rea|extensi[oó]n/i);
  });

  it.each(["maíz o café", "maíz y café", "mango y yuca"])("pide aclarar dos cultivos en %s", (crops) => {
    expectReview(cropContract.replace("maíz", crops), /cultivo/i);
  });

  it("pide aclarar dos fechas alternativas", () => {
    expectReview(cropContract.replace("2 de marzo de 2027", "2 de marzo o el 3 de abril"), /fecha|inicio/i);
  });

  it.each([
    "4 vacas de los cuales 5 terneras fin",
    "4 vacas de los cuales 2 terneras y 3 terneras fin",
    "8 vacas de los cuales 3 terneras de los cuales 4 terneras fin fin",
  ])("bloquea un subgrupo que supera su cantidad de origen (%s)", (animals) => {
    expectReview(pastoreo + " para " + animals, /subgrupo|grupo|cantidad/i);
  });

  it("conserva los dos niveles de anidación y genera cuando las cantidades cuadran", () => {
    const result = runPipeline(pastoreo + " para 4 vacas de los cuales 2 terneras de los cuales 1 ternera fin fin");
    expect(result.contract?.accepted).toBe(true);
    expect(result.fields.animales?.[0]?.sub?.[0]?.sub?.[0]?.cantidad).toBe(1);
  });

  it("admite una repetición exacta de los campos de una misma descripción", () => {
    const result = runPipeline(cropContract + " lote 20 valor 900 mil pesos desde el 2 de marzo de 2027");
    expect(result.contract?.accepted).toBe(true);
    expect(result.fields).toMatchObject({
      lote: "20",
      valor: { monto: 900_000, moneda: "pesos" },
      fecha: { dia: 2, mes: 3, anio: 2027 },
    });
  });

  it.each(["unos 900 mil pesos", "900 mil pesos aproximadamente", "2 pesos mil"])(
    "pide un valor exacto y en el orden esperado cuando se dicta %s",
    (value) => expectReview(crop + " valor " + value, /valor/i),
  );

  it("admite la escala de mil millones con su moneda explícita", () => {
    const result = runPipeline(crop + " valor 2 mil millones de pesos");
    expect(result.errors).toEqual([]);
    expect(result.fields.valor).toEqual({ monto: 2_000_000_000, moneda: "pesos" });
    expect(result.contract?.output).toContain("$ 2.000.000.000 pesos");
  });

  it("pide el año con cuatro cifras cuando el dictado aporta un año abreviado", () => {
    expectReview(cropContract.replace("2027", "27"), /año.*cuatro cifras/i);
  });

  it("pide aclarar una cantidad aproximada o una repetición de un grupo", () => {
    expectReview(pastoreo + " para aproximadamente 4 vacas", /aproximadamente/i);
    expectReview(pastoreo + " para 4 vacas y 2 toros 4 vacas", /animales repetidos/i);
  });

  it("acepta una corrección explícita del valor en un turno posterior", () => {
    const { fields } = runPipeline(cropContract);
    const result = runPipeline("valor 800 mil pesos", fields);
    expect(result.contract?.output).toContain("$ 800.000 pesos");
  });
});

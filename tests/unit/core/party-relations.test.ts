import { describe, expect, it } from "vitest";
import { runPipeline } from "../../../src/core/pipeline";

describe("party role relations in the dictation", () => {
  it.each([
    ["el arrendador es Juan Gomez", "arrendador", "Juan Gomez"],
    ["el vecino Juan quien sería el arrendador", "arrendador", "Juan"],
    ["María José de la Cruz, quien actuaría como la arrendataria", "arrendatario", "María José de la Cruz"],
    ["la arrendataria se llama Ana Gómez", "arrendatario", "Ana Gómez"],
    ["el vecino juan quien sería el arrendador", "arrendador", "juan"],
    ["la vecina maría de la cruz quien sería la arrendataria", "arrendatario", "maría de la cruz"],
    ["Como arrendador, Juan de la Cruz", "arrendador", "Juan de la Cruz"],
    ["nombre del arrendatario Óscar León", "arrendatario", "Óscar León"],
    ["Yo, Juan Gómez, sería el arrendador", "arrendador", "Juan Gómez"],
  ] as const)("recognizes %s", (input, role, name) => {
    const result = runPipeline(input);
    expect(result.fields[role]).toBe(name);
  });

  it("asks for confirmation when two names are proposed for one role", () => {
    const result = runPipeline("el arrendador es Juan o Pedro");
    expect(result.fields.arrendador).toBeUndefined();
    expect([...result.errors, result.question].join(" ")).toMatch(/(?=.*arrendador)(?=.*confirm)/i);
  });

  it("keeps two clear reverse relations separate", () => {
    const result = runPipeline("Juan Gómez será el arrendador y Ana Pérez quedaría como la arrendataria");
    expect(result.fields).toEqual({ arrendador: "Juan Gómez", arrendatario: "Ana Pérez" });
  });

  it("keeps a negated name unassigned and a supplier clause intact", () => {
    const result = runPipeline("el arrendador no es Juan, la arrendataria aporta los insumos");
    expect(result.fields).toEqual({ insumos: "arrendatario" });
    expect(result.errors).toContainEqual(expect.stringMatching(/arrendador.*Confirme/));
  });
});

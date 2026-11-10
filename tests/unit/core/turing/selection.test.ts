import { describe, expect, it } from "vitest";
import { getTemplate, TEMPLATES } from "../../../../src/core/templates";
import { selectTemplate } from "../../../../src/core/turing/selection";

describe("selectTemplate", () => {
  it("chooses PASTOREO for the §5.4 example", () => {
    const result = selectTemplate(["lote", "hectareas", "tipo_animal", "cantidad_animales", "raza", "uso"], TEMPLATES);
    expect(result.templateId).toBe("PASTOREO");
    expect(result.scores.PASTOREO?.matched).toBe(3);
    expect(result.scores.CULTIVO?.matched).toBe(1);
    expect(result.scores.MIXTA?.matched).toBe(3);
    expect(result.tie).toBe(false);
    expect(result.low).toBe(false);
    expect(result.run.accepted).toBe(true);
  });

  it("writes one unary tally per template on the tape", () => {
    const result = selectTemplate(["lote"], TEMPLATES);
    expect(result.run.output).toContain("%PASTOREO:5 1 %CULTIVO:4 1 %MIXTA:6 1");
  });

  it("writes the winning template and flags to the final tape", () => {
    const result = selectTemplate(getTemplate("MIXTA").required, TEMPLATES);
    expect(result.run.snapshots.at(-1)?.tape.at(-1)).toBe("RESULT:MIXTA:0:0");
  });

  it("flags a tie when two templates reach the same proportion", () => {
    // A: 1/2 and B: 2/4 are both 50 %
    const a = { ...getTemplate("PASTOREO"), id: "PASTOREO" as const, required: ["lote", "uso"] };
    const b = { ...getTemplate("CULTIVO"), id: "CULTIVO" as const, required: ["lote", "valor", "cultivo", "fecha"] };
    const result = selectTemplate(["lote", "valor"], [a, b]);
    expect(result.tie).toBe(true);
  });

  it("leaves an exact incomplete tie unresolved in either template order", () => {
    const pastoreo = { ...getTemplate("PASTOREO"), required: ["lote", "uso"] };
    const cultivo = { ...getTemplate("CULTIVO"), required: ["lote", "cultivo"] };
    const results = [
      selectTemplate(["lote"], [pastoreo, cultivo]),
      selectTemplate(["lote"], [cultivo, pastoreo]),
    ];

    expect(results.map((result) => result.templateId)).toEqual([null, null]);
    for (const result of results) {
      expect(result).toMatchObject({ tie: true, low: false });
      expect(result.run.snapshots.at(-1)?.tape.at(-1)).toBe("RESULT:-:1:0");
    }
  });

  it("prefers the template covering more fields when both are complete (no tie)", () => {
    const result = selectTemplate(getTemplate("MIXTA").required, TEMPLATES);
    expect(result.templateId).toBe("MIXTA");
    expect(result.tie).toBe(false);
  });

  it("chooses CULTIVO for a crop dictation", () => {
    const result = selectTemplate(["lote", "hectareas", "cultivo", "insumos", "fecha", "duracion", "valor"], TEMPLATES);
    expect(result.templateId).toBe("CULTIVO");
    expect(result.scores.CULTIVO).toEqual({ matched: 4, total: 4 });
  });

  it("flags a low match when the best proportion is under 50 %", () => {
    const result = selectTemplate(["lote", "hectareas"], TEMPLATES);
    expect(result.low).toBe(true);
  });

  it("returns no template when nothing matches", () => {
    const result = selectTemplate([], TEMPLATES);
    expect(result.templateId).toBeNull();
    expect(result.low).toBe(true);
  });

  it("compares on the tape using q_comparar states", () => {
    const result = selectTemplate(["lote"], TEMPLATES);
    expect(result.run.snapshots.some((s) => s.state.startsWith("q_comparar"))).toBe(true);
  });
});

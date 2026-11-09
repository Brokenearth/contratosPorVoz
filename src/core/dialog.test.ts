import { describe, expect, it } from "vitest";
import { guideText, mergeFields, missingFields, questionFor } from "./dialog";
import { parseContract } from "./parser";
import { tokens } from "./parser/test-tokens";

const pastoreo = { required: ["animal", "lote", "fecha", "valor", "uso"], optional: ["raza", "cantidad", "duracion"] };

describe("dialog (§5.6)", () => {
  it("builds the guide from the template declaration", () => {
    const text = guideText(pastoreo);
    expect(text).toContain("Para redactar su contrato, mencione:");
    expect(text).toContain("• Tipo de animal (y raza, si aplica)");
    expect(text).toContain("• Para qué se usará (uso)");
    expect(text).toContain("Opcional: raza, cantidad de animales, duración");
    expect(text).toContain("Puede decirlo en el orden que prefiera.");
    expect(guideText({ required: ["cultivo"], optional: [] })).not.toContain("animal");
  });

  it("asks only for what is missing and merges the answer", () => {
    const first = parseContract(tokens("20 vacas holstein en el lote 7 por un valor de 2 millones de pesos")).fields;
    const missing = missingFields(first, pastoreo.required);
    expect(missing).toEqual(["fecha", "uso"]);
    expect(questionFor(missing)).toBe("Falta la fecha y para qué se usará el lote.");

    const answer = parseContract(tokens("desde el 15 de noviembre para ganadería de leche")).fields;
    const merged = mergeFields(first, answer);
    expect(missingFields(merged, pastoreo.required)).toEqual([]);
    expect(merged.uso).toBe("ganadería de leche");
    expect(merged.fecha).toEqual({ dia: 15, mes: 11 });
    expect(merged.lote).toBe("7");
  });

  it("handles one, three and zero missing fields", () => {
    expect(questionFor(["valor"])).toBe("Falta el valor del arrendamiento.");
    expect(questionFor(["animal", "lote", "cultivo"])).toBe(
      "Falta el tipo de animal, el número o nombre del lote y el cultivo.",
    );
    expect(questionFor([])).toBe("");
  });

  it("checks optional animal details and unknown keys", () => {
    const fields = { animales: [{ animal: "vacas", sub: [{ cantidad: 2, animal: "terneras", raza: "gir" }] }] };
    expect(missingFields(fields, ["cantidad", "raza", "duración", "otro"])).toEqual(["duración", "otro"]);
    expect(questionFor(["otro"])).toBe("Falta otro.");
  });

  it("keeps previous values that the new answer does not mention", () => {
    expect(mergeFields({ lote: "1", uso: "pastoreo" }, { uso: "ceba" })).toEqual({ lote: "1", uso: "ceba" });
  });
});

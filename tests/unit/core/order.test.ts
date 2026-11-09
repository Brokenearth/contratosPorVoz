import { describe, expect, it } from "vitest";
import { tokenize } from "../../../src/core/lexer";
import { parseContract } from "../../../src/core/parser";
import { runPipeline } from "../../../src/core/pipeline";
import type { ContractFields } from "../../../src/core/types";

/** Fields with sorted keys, so two dictations compare equal whatever the clause order. */
const canon = (fields: ContractFields): string =>
  JSON.stringify(Object.keys(fields).sort().map((key) => [key, fields[key as keyof ContractFields]]));

function* permutations<T>(items: T[]): Generator<T[]> {
  if (items.length <= 1) {
    yield items;
    return;
  }
  for (let i = 0; i < items.length; i++) {
    for (const rest of permutations([...items.slice(0, i), ...items.slice(i + 1)])) yield [items[i] as T, ...rest];
  }
}

/** Every `step`-th permutation: a deterministic sample of all clause orders (the full set is run by hand). */
function sampleOrders<T>(items: T[], step: number): T[][] {
  const sample: T[][] = [];
  let i = 0;
  for (const order of permutations(items)) if (i++ % step === 0) sample.push(order);
  return sample;
}

const CASES: { id: string; name: string; clauses: string[] }[] = [
  {
    id: "PASTOREO",
    name: "pastoreo",
    clauses: ["arriendo", "el lote La Esperanza de 5 hectáreas", "20 vacas de raza holstein", "para producción de leche",
      "por 12 meses", "desde el 15 de noviembre de 2026", "por un valor de 6 millones de pesos"],
  },
  {
    id: "PASTOREO",
    name: "pastoreo con sinónimos",
    clauses: ["se arrienda", "por un período de 12 meses", "a partir del 15 de noviembre de 2026",
      "el lote denominado La Esperanza, con una extensión de 5 hectáreas",
      "destinado al mantenimiento de 20 reses de raza Holstein", "para producción de leche",
      "por la suma de $6.000.000 de pesos"],
  },
  {
    id: "CULTIVO",
    name: "cultivo",
    clauses: ["arriendo", "el lote 12 de 4 hectáreas", "para cultivo de café", "por 2 años",
      "desde el 10 de enero de 2027", "por un valor de 5 millones de pesos", "el arrendador aporta los insumos"],
  },
  {
    id: "CULTIVO",
    name: "cultivo con sinónimos",
    clauses: ["doy en arriendo", "la finca 12 de 4 hectáreas", "para cultivo de café", "durante 2 años",
      "contado desde el 10 de enero de 2027", "por un canon de 5 millones de pesos colombianos",
      "los insumos corren por cuenta del propietario"],
  },
  {
    id: "MIXTA",
    name: "mixta",
    clauses: ["arriendo", "el lote 4 de 10 hectáreas", "15 vacas de raza gir", "para ganadería de leche",
      "para cultivo de maíz", "por 1 año", "desde el 1 de marzo de 2027", "por un valor de 8 millones de pesos",
      "los insumos los aporta el arrendador"],
  },
  {
    id: "MIXTA",
    name: "mixta con sinónimos",
    clauses: ["se arrienda", "en la parcela llamada El Roble de 10 hectáreas", "unas 15 vacas de raza gir",
      "para ganadería de leche", "para cultivo de maíz", "por un plazo de 1 año", "a partir del 1 de marzo de 2027",
      "por un precio de 8.000.000 de pesos", "el dueño suministra los insumos"],
  },
];

describe("clauses in any order (§5.5) with plain words and synonyms", () => {
  it.each(CASES)("$name: every sampled order gives the same template and fields", ({ id, clauses }) => {
    const reference = runPipeline(clauses.join(" "));
    expect(reference.template?.id).toBe(id);
    expect(reference.missing).toEqual([]);
    expect(reference.errors).toEqual([]);
    for (const order of sampleOrders(clauses, clauses.length > 7 ? 2999 : 127)) {
      for (const joiner of [" ", ", "]) {
        const result = runPipeline(order.join(joiner));
        expect(result.errors, order.join(joiner)).toEqual([]);
        expect(result.template?.id).toBe(id);
        expect(canon(result.fields)).toBe(canon(reference.fields));
      }
    }
  });

  it("plain and synonym dictations of the same contract give the same fields", () => {
    for (let i = 0; i < CASES.length; i += 2) {
      const plain = CASES[i];
      const synonyms = CASES[i + 1];
      if (plain === undefined || synonyms === undefined) continue;
      const a = runPipeline(plain.clauses.join(" ")).fields;
      const b = runPipeline(synonyms.clauses.join(" ")).fields;
      // The synonym version names the lot differently in the mixed case; the rest must match.
      expect({ ...b, lote: a.lote }).toEqual({ ...a });
    }
  });

  it("the user's formal wording is understood like the demo dictation", () => {
    const demo = runPipeline(
      "arriendo lote La Esperanza de 5 hectáreas para 20 vacas de raza holstein para producción de leche por 12 meses " +
        "desde el 15 de noviembre de 2026 por un valor de 6 millones de pesos",
    );
    const formal = runPipeline(
      "Se arrienda por un período de 12 meses, a partir del 15 de noviembre de 2026, el lote denominado La Esperanza, " +
        "con una extensión de 5 hectáreas, destinado al mantenimiento de 20 vacas de raza Holstein para producción " +
        "de leche, por un valor de $6.000.000 de pesos.",
    );
    expect(formal.errors).toEqual([]);
    expect(formal.template?.id).toBe("PASTOREO");
    expect(canon(formal.fields)).toBe(canon(demo.fields));
  });
});

describe("synonym dictionary", () => {
  it("rewrites a phrase into canonical tokens that keep the original words and span", () => {
    const [desde, el] = tokenize("a partir del 15 de noviembre").tokens;
    expect(desde).toMatchObject({ type: "PALABRA_CLAVE", lexeme: "desde", synonymOf: "a partir del", start: 0, end: 12 });
    expect(el).toMatchObject({ lexeme: "el", synonymOf: "a partir del" });
  });

  it("chains rewrites and drops filler words", () => {
    const lexemes = tokenize("la finca denominada El Roble con aproximadamente 20 reses").tokens.map((t) => t.lexeme);
    expect(lexemes).toEqual(["el", "lote", "El", "Roble", "con", "20", "vacas"]);
  });

  it("skips the $ sign before an amount", () => {
    const result = tokenize("$6.000.000");
    expect(result.errors).toEqual([]);
    expect(result.tokens.map((t) => t.value)).toEqual([6_000_000]);
  });
});

describe("panic-mode recovery in the pushdown automaton", () => {
  it("skips a word that starts no clause and keeps the rest of the dictation", () => {
    const parse = parseContract(tokenize("arriendo el lote 3 bonito para 10 vacas").tokens);
    expect(parse.ok).toBe(true);
    expect(parse.warnings).toEqual(["Se ignoró 'bonito' en la posición 19: no inicia ninguna cláusula."]);
    expect(parse.fields).toMatchObject({ lote: "3", animales: [{ cantidad: 10, animal: "vacas" }] });
    expect(parse.trace.some((step) => step.action.startsWith("descarta 'bonito'"))).toBe(true);
  });

  it("still rejects 'fin' without 'de los cuales'", () => {
    const parse = parseContract(tokenize("20 vacas fin").tokens);
    expect(parse.ok).toBe(false);
    expect(parse.errors[0]).toContain("'fin' sin 'de los cuales'");
  });
});

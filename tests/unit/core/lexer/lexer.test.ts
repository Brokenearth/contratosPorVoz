import { describe, expect, it } from "vitest";
import { runDfa } from "../../../../src/core/regex";
import { TOKEN_DEFINITIONS, getTokenAutomata, normalize, tokenize } from "../../../../src/core/lexer/index";

const stream = (text: string): string[] => tokenize(text).tokens.map((t) => `${t.type}:${t.value}`);

describe("normalize", () => {
  it("lowercases and strips accents but keeps ñ and the original length", () => {
    expect(normalize("Hectáreas MAÍZ Año")).toBe("hectareas maiz año");
    expect(normalize("Cebú").length).toBe(4);
  });
});

describe("tokenize — proposal §5.1 step by step", () => {
  it("vacas → ANIMAL(vaca) taking the s branch", () => {
    const result = tokenize("vacas");
    expect(stream("vacas")).toEqual(["ANIMAL:vaca"]);
    expect(result.trace).toEqual([
      { position: 0, tokenType: "ANIMAL", dfaStates: expect.any(Array) as string[], accepted: true },
    ]);
    expect(result.trace[0]?.dfaStates).toHaveLength(6);
  });

  it("vaca → ANIMAL(vaca) taking the λ branch", () => {
    expect(stream("vaca")).toEqual(["ANIMAL:vaca"]);
    expect(tokenize("vaca").trace[0]?.dfaStates).toHaveLength(5);
  });

  it("20 → NUM(20) visiting one DFA state per digit", () => {
    const result = tokenize("20");
    expect(result.tokens).toEqual([{ type: "NUM", lexeme: "20", value: 20, start: 0, end: 2 }]);
    expect(result.trace[0]?.dfaStates).toEqual(runDfa(getTokenAutomata("NUM").dfa, "20").states);
  });
});

describe("tokenize — dates and amounts", () => {
  it("15 de noviembre de 2026 (§5.5)", () => {
    expect(stream("15 de noviembre de 2026")).toEqual([
      "NUM:15",
      "PALABRA_CLAVE:de",
      "MES:11",
      "PALABRA_CLAVE:de",
      "NUM:2026",
    ]);
  });

  it("reads thousands separators, number words and currency words", () => {
    expect(stream("1.500.000 pesos")).toEqual(["NUM:1500000", "MONEDA:peso"]);
    expect(stream("veinte vacas por 5 millones")).toEqual([
      "NUM:20",
      "ANIMAL:vaca",
      "PALABRA_CLAVE:por",
      "NUM:5",
      "MONEDA:millón",
    ]);
  });
});

describe("tokenize — proposal §6 example sentence", () => {
  const sentence =
    "arriendo lote La Esperanza de 5 hectáreas para 20 vacas de raza holstein para producción de leche por 12 meses";

  it("produces the expected token stream", () => {
    expect(stream(sentence)).toEqual([
      "VERBO:arriendo",
      "PALABRA_CLAVE:lote",
      "PALABRA_CLAVE:la",
      "NOMBRE:Esperanza",
      "PALABRA_CLAVE:de",
      "NUM:5",
      "UNIDAD_AREA:hectárea",
      "PALABRA_CLAVE:para",
      "NUM:20",
      "ANIMAL:vaca",
      "PALABRA_CLAVE:de",
      "PALABRA_CLAVE:raza",
      "RAZA:holstein",
      "PALABRA_CLAVE:para",
      "USO:producción",
      "PALABRA_CLAVE:de",
      "USO:leche",
      "PALABRA_CLAVE:por",
      "NUM:12",
      "UNIDAD_TIEMPO:mes",
    ]);
    expect(tokenize(sentence).errors).toEqual([]);
  });

  it("keeps original lexemes and positions", () => {
    const token = tokenize(sentence).tokens[2];
    expect(token).toEqual({ type: "PALABRA_CLAVE", lexeme: "La", value: "la", start: 14, end: 16 });
    const hectareas = tokenize(sentence).tokens[6];
    expect(hectareas?.lexeme).toBe("hectáreas");
  });
});

describe("tokenize — §5.5 sentences and other categories", () => {
  it("handles commas, connectors and verbs", () => {
    expect(stream("por 30 días, lote 20, 20 toros gir y 3 bueyes")).toEqual([
      "PALABRA_CLAVE:por",
      "NUM:30",
      "UNIDAD_TIEMPO:día",
      "COMA:,",
      "PALABRA_CLAVE:lote",
      "NUM:20",
      "COMA:,",
      "NUM:20",
      "ANIMAL:toro",
      "RAZA:gir",
      "CONECTOR:y",
      "NUM:3",
      "ANIMAL:buey",
    ]);
    expect(stream("los toros se arriendan")).toEqual([
      "PALABRA_CLAVE:los",
      "ANIMAL:toro",
      "PALABRA_CLAVE:se",
      "VERBO:arriendan",
    ]);
  });

  it("recognizes crops, inputs, parties and nesting keywords", () => {
    expect(stream("cultivo de MAÍZ y frijoles, el arrendatario aporta los insumos de los cuales fin")).toEqual([
      "USO:cultivo",
      "PALABRA_CLAVE:de",
      "CULTIVO:maíz",
      "CONECTOR:y",
      "CULTIVO:frijol",
      "COMA:,",
      "PALABRA_CLAVE:el",
      "PALABRA_CLAVE:arrendatario",
      "PALABRA_CLAVE:aporta",
      "PALABRA_CLAVE:los",
      "INSUMOS:insumo",
      "PALABRA_CLAVE:de",
      "PALABRA_CLAVE:los",
      "PALABRA_CLAVE:cuales",
      "PALABRA_CLAVE:fin",
    ]);
  });

  it("uses longest match so prefixes of known words become NOMBRE", () => {
    expect(stream("vacaciones Pedro")).toEqual(["NOMBRE:vacaciones", "NOMBRE:Pedro"]);
    expect(stream("arrendador")).toEqual(["PALABRA_CLAVE:arrendador"]);
  });
});

describe("tokenize — errors", () => {
  it("reports unknown symbols and keeps going", () => {
    const result = tokenize("20 # vacas");
    expect(result.tokens.map((t) => t.type)).toEqual(["NUM", "ANIMAL"]);
    expect(result.errors).toEqual([{ position: 3, lexeme: "#", message: "Símbolo desconocido '#'" }]);
    expect(result.trace[1]).toEqual({ position: 3, tokenType: null, dfaStates: [], accepted: false });
  });

  it("ignores whitespace and sentence punctuation", () => {
    expect(stream("  ¿20 vacas?.  ")).toEqual(["NUM:20", "ANIMAL:vaca"]);
    expect(tokenize("").tokens).toEqual([]);
  });
});

describe("token automata", () => {
  it("exposes the regex, NFA and DFA of every definition", () => {
    expect(TOKEN_DEFINITIONS[0]?.regex).toBe("DIGITO DIGITO*");
    const animal = getTokenAutomata("ANIMAL");
    expect(animal.regex).toContain("(s|λ)");
    expect(animal.nfa.initial).toBe("q0");
    expect(runDfa(animal.dfa, "terneras").accepted).toBe(true);
    expect(() => getTokenAutomata("NOPE")).toThrow();
  });
});

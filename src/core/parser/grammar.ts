/**
 * Context-free grammar of the dictated contract (proposal §5.2 and §5.5),
 * stored as plain data so it can be printed and driven by the pushdown automaton.
 *
 * Symbol notation (a symbol is a string):
 *  - NONTERMINAL: upper case, listed in `nonterminals` (e.g. LOTE).
 *  - token-category terminal: lower-case TokenType name (num, animal, raza, mes,
 *    moneda, unidad_tiempo, unidad_area, verbo, uso, cultivo, nombre).
 *  - keyword terminal: the word in double quotes ("lote", "de", ",", "y").
 *    It matches any token whose normalized lexeme is that word. Expected
 *    PALABRA_CLAVE lexemes: lote, en, el, la, los, las, de, raza, por, para, un,
 *    valor, desde, cuales, fin, arrendador, arrendatario, insumos, aporta, se;
 *    CONECTOR "y"; COMA ",".
 *  - λ: an empty body.
 */
export interface Production {
  head: string;
  body: string[];
}

export interface Grammar {
  start: string;
  nonterminals: string[];
  productions: Production[];
}

const RULES: [string, string[][]][] = [
  ["CONTRATO", [["CLAUSULA", "CONTRATO"], []]],
  ["CLAUSULA", [["ANIMALES"], ["LOTE"], ["VALOR"], ["FECHA"], ["DURACION"], ["USO"], ["CULTIVO"],
    ["INSUMOS"], ["PARTES"], ["VERBO"], ["SEP"]]],
  ["SEP", [['","'], ['"y"']]],
  ["ANIMALES", [["ARTANIM", "LISTA"]]],
  ["ARTANIM", [['"los"'], ['"las"'], ['"para"'], []]],
  ["LISTA", [["ITEM", "RESTO"]]],
  ["RESTO", [['","', "ITEM", "RESTO"], ['"y"', "ITEM"], []]],
  ["ITEM", [["num", "animal", "RAZAOPT", "SUBOPT"], ["animal", "RAZAOPT", "SUBOPT"]]],
  ["RAZAOPT", [['"de"', '"raza"', "raza"], ["raza"], []]],
  ["SUBOPT", [['"de"', '"los"', '"cuales"', "LISTA", '"fin"'], []]],
  ["LOTE", [["ARTLOTE", '"lote"', "ID", "AREAOPT"]]],
  ["ARTLOTE", [['"en"', '"el"'], ['"el"'], []]],
  ["ID", [["num"], ["NOMBREPROPIO"]]],
  ["NOMBREPROPIO", [["ART", "nombre", "NOMBRES"]]],
  ["NOMBRES", [["nombre", "NOMBRES"], []]],
  ["AREAOPT", [['"de"', "num", "unidad_area"], []]],
  ["VALOR", [['"por"', '"un"', '"valor"', '"de"', "MONTO"], ['"valor"', "DEOPT", "MONTO"]]],
  ["DEOPT", [['"de"'], []]],
  ["MONTO", [["num", "moneda", "MONEDAOPT"], ["num", '"de"', "moneda"]]],
  ["MONEDAOPT", [['"de"', "moneda"], ["moneda"], []]],
  ["FECHA", [['"desde"', '"el"', "num", '"de"', "mes", "ANIOOPT"], ['"el"', "num", '"de"', "mes", "ANIOOPT"]]],
  ["ANIOOPT", [['"de"', "num"], []]],
  ["DURACION", [['"por"', "num", "unidad_tiempo"]]],
  ["USO", [['"para"', "uso", "USOTAIL"]]],
  ["USOTAIL", [['"de"', "uso", "USOTAIL"], []]],
  ["CULTIVO", [["CULTPREF", "cultivo"]]],
  ["CULTPREF", [['"para"'], ['"de"'], []]],
  ["INSUMOS", [["ART", '"insumos"', "ART", '"aporta"', "ART", "ROL"]]],
  ["PARTES", [["ART", "ROL", "ROLTAIL"]]],
  ["ROL", [['"arrendador"'], ['"arrendatario"']]],
  ["ROLTAIL", [['"aporta"', "ART", '"insumos"'], ["nombre", "NOMBRES"]]],
  ["ART", [['"el"'], ['"la"'], ['"los"'], ['"las"'], []]],
  ["VERBO", [["verbo"], ['"se"', "verbo"]]],
];

export const grammar: Grammar = {
  start: "CONTRATO",
  nonterminals: RULES.map(([head]) => head),
  productions: RULES.flatMap(([head, bodies]) => bodies.map((body) => ({ head, body }))),
};

export function isNonterminal(symbol: string): boolean {
  return grammar.nonterminals.includes(symbol);
}

export function isKeyword(symbol: string): boolean {
  return symbol.startsWith('"');
}

/** The n-th alternative (0-based) of a nonterminal, in declaration order. */
export function productionOf(head: string, alternative: number): Production {
  const found = grammar.productions.filter((p) => p.head === head)[alternative];
  if (found === undefined) throw new Error(`No existe la alternativa ${alternative} de ${head}`);
  return found;
}

export function formatProduction(p: Production): string {
  return `${p.head} → ${p.body.length === 0 ? "λ" : p.body.join(" ")}`;
}

/** Prints the grammar in course notation: one line per nonterminal, alternatives joined by "|". */
export function formatGrammar(g: Grammar): string {
  return g.nonterminals
    .map((head) => {
      const bodies = g.productions
        .filter((p) => p.head === head)
        .map((p) => (p.body.length === 0 ? "λ" : p.body.join(" ")));
      return `${head} → ${bodies.join(" | ")}`;
    })
    .join("\n");
}

import type { Token } from "../types";
import { grammar, isKeyword } from "./grammar";

/** Lower case without accents: "Días" → "dias". */
export function normalize(text: string): string {
  let out = "";
  for (const ch of text.toLowerCase().normalize("NFD")) {
    const code = ch.charCodeAt(0);
    if (code < 0x300 || code > 0x36f) out += ch;
  }
  return out;
}

/** Does `token` match the terminal `symbol`? Keywords compare the lexeme, categories the token type. */
export function matches(token: Token | undefined, symbol: string): boolean {
  if (token === undefined) return false;
  if (symbol === "*") return true;
  if (isKeyword(symbol)) return normalize(token.lexeme) === normalize(symbol.slice(1, -1));
  return token.type.toLowerCase() === symbol;
}

/** One row of the LL(2) prediction table: if the next tokens match `when`, use alternative `use`. */
interface Row {
  when: [string] | [string, string];
  use: number;
}

const row = (use: number, ...when: [string] | [string, string]): Row => ({ when, use });

/**
 * Prediction table (proposal §5.5): the automaton looks at 1 or 2 tokens ahead
 * to pick the production. "*" matches any token. Rows are tried in order; if
 * none matches, the λ alternative is used when the nonterminal has one.
 * Alternative numbers follow the declaration order in grammar.ts.
 */
// Materia §5.5: decisión predictiva escrita a mano, con hasta dos tokens de
// anticipación. Compare «por» + num (duración) con «por» + «un» (valor).
// Esta tabla no se obtiene automáticamente de FIRST/FOLLOW.
export const PREDICT: Record<string, Row[]> = {
  CONTRATO: [row(0, "*")],
  CLAUSULA: [
    row(0, "num", "animal"), row(0, "animal"),
    row(7, '"los"', '"insumos"'),
    row(0, '"los"', "num"), row(0, '"los"', "animal"), row(0, '"las"', "num"), row(0, '"las"', "animal"),
    row(0, '"para"', "num"), row(0, '"para"', "animal"),
    row(1, '"lote"'), row(1, '"en"', '"el"'), row(1, '"el"', '"lote"'),
    row(2, '"por"', '"un"'), row(2, '"valor"'),
    row(3, '"desde"'), row(3, '"el"', "num"),
    row(4, '"por"', "num"),
    row(5, '"para"', "uso"),
    row(6, "cultivo"), row(6, '"para"', "cultivo"), row(6, '"de"', "cultivo"),
    row(7, '"insumos"'),
    row(8, '"arrendador"'), row(8, '"arrendatario"'), row(8, '"el"', '"arrendador"'), row(8, '"el"', '"arrendatario"'),
    row(9, "verbo"), row(9, '"se"', "verbo"),
    row(10, '","'), row(10, '"y"'),
  ],
  SEP: [row(0, '","'), row(1, '"y"')],
  ARTANIM: [row(0, '"los"'), row(1, '"las"'), row(2, '"para"')],
  RESTO: [row(0, '","', "num"), row(0, '","', "animal"), row(1, '"y"', "num"), row(1, '"y"', "animal")],
  ITEM: [row(0, "num"), row(1, "animal")],
  RAZAOPT: [row(0, '"de"', '"raza"'), row(1, "raza")],
  SUBOPT: [row(0, '"de"', '"los"')],
  ARTLOTE: [row(0, '"en"'), row(1, '"el"')],
  ID: [row(0, "num"), row(1, '"el"'), row(1, '"la"'), row(1, '"los"'), row(1, '"las"'), row(1, "nombre")],
  NOMBRES: [row(0, "nombre")],
  AREAOPT: [row(0, '"de"', "num")],
  VALOR: [row(0, '"por"'), row(1, '"valor"')],
  DEOPT: [row(0, '"de"')],
  MONTO: [row(0, "num", "moneda"), row(1, "num", '"de"')],
  MONEDAOPT: [row(0, '"de"', "moneda"), row(1, "moneda")],
  FECHA: [row(0, '"desde"'), row(1, '"el"')],
  ANIOOPT: [row(0, '"de"', "num")],
  USOTAIL: [row(0, '"de"', "uso")],
  CULTPREF: [row(0, '"para"'), row(1, '"de"')],
  ROL: [row(0, '"arrendador"'), row(1, '"arrendatario"')],
  ROLTAIL: [row(0, '"aporta"'), row(1, "nombre")],
  ART: [row(0, '"el"'), row(1, '"la"'), row(2, '"los"'), row(3, '"las"')],
  VERBO: [row(0, "verbo"), row(1, '"se"')],
};

/**
 * Chooses the alternative of `head` for the lookahead tokens, or null when no
 * production applies (syntax error). Nonterminals with a single production
 * always use it; their terminals report the error when they are matched.
 */
export function predict(head: string, la1: Token | undefined, la2: Token | undefined): number | null {
  const alternatives = grammar.productions.filter((p) => p.head === head);
  if (alternatives.length === 1) return 0;
  for (const r of PREDICT[head] ?? []) {
    const [first, second] = r.when;
    if (matches(la1, first) && (second === undefined || matches(la2, second))) return r.use;
  }
  const lambda = alternatives.findIndex((p) => p.body.length === 0);
  return lambda >= 0 ? lambda : null;
}

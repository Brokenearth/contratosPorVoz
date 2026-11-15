import { normalize } from "../lexer/normalize";
import type { ParseResult, Token } from "../types";
import { extractFields } from "./fields";
import { runPda, type PdaTraceStep } from "./pda";

export { formatGrammar, formatProduction, grammar, type Grammar, type Production } from "./grammar";
export { PREDICT } from "./predict";
export { extractFields } from "./fields";
export type { PdaTraceStep } from "./pda";

/** ParseResult whose trace also carries the grammar-symbol stack of each step. */
export interface ParseOutcome extends ParseResult {
  trace: PdaTraceStep[];
  warnings: string[];
  /** Data that must be reviewed even if the PDA accepted the recoverable syntax. */
  issues: string[];
}

/** Parses `tokens` starting from any nonterminal (e.g. "LISTA" to show the §5.2 AST). */
export function parseFrom(start: string, tokens: Token[]): ParseOutcome {
  const run = runPda(start, tokens);
  const approximation = tokens.find((token, index) =>
    token.type === "NOMBRE" && !token.partyName && normalize(token.lexeme) === "aproximadamente" &&
    (tokens[index + 1]?.type === "NUM" ||
      ["MONEDA", "ANIMAL", "UNIDAD_AREA", "UNIDAD_TIEMPO"].includes(tokens[index - 1]?.type ?? "")),
  );
  const issues: string[] = approximation
    ? ["Indique el valor, el área o la cantidad exacta. «" +
        (approximation.synonymOf ?? approximation.lexeme) + "» expresa una aproximación."]
    : [];
  const fields = extractFields(run.tree, run.warnings, issues);
  return { ...run, fields, issues };
}

/** Parses a whole dictated contract (CONTRATO → CLAUSULA CONTRATO | λ). */
export function parseContract(tokens: Token[]): ParseOutcome {
  return parseFrom("CONTRATO", tokens);
}

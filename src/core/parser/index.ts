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
}

/** Parses `tokens` starting from any nonterminal (e.g. "LISTA" to show the §5.2 AST). */
export function parseFrom(start: string, tokens: Token[]): ParseOutcome {
  const run = runPda(start, tokens);
  const fields = extractFields(run.tree, run.warnings);
  return { ...run, fields };
}

/** Parses a whole dictated contract (CONTRATO → CLAUSULA CONTRATO | λ). */
export function parseContract(tokens: Token[]): ParseOutcome {
  return parseFrom("CONTRATO", tokens);
}

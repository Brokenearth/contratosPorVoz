import type { SelectionResult, TemplateDef } from "../types";
import { END } from "./fill";
import { BLANK, runMachine, type RunOptions, type Transition, type TuringMachine } from "./machine";

/**
 * Selection machine (§5.4).
 *
 * Tape:  campo1 … campoN  #  @PASTOREO m1 m2 …  @CULTIVO m1 …  @MIXTA …  ⊣
 * (the extracted field names, a separator, then each template header followed by its required markers).
 *
 * Phase 1 — compare. For every marker m to the right of "#":
 *   q_siguiente marks it "*m" and q_volver[m] walks left to "#"; q_comparar[m] keeps walking left over
 *   the extracted names: equal to m → q_encontrado[m], left blank → q_ausente[m]. Both walk right back
 *   to "*m" and write "✓m" or "✗m".
 * Phase 2 — count. q_contar walks the blocks again: a header "@X" becomes "=X" and appends the tally
 *   header "%X" after the end; each "✓m" becomes "+m" and appends a unary "1". q_retorno walks left to
 *   the last processed cell ("+" or "="). At "⊣" the machine accepts (q_fin).
 * Final tape (tail): ⊣ %PASTOREO 1 1 1 … %CULTIVO 1 1 … %MIXTA …
 */
const SEPARATOR = "#";
const HEADER = "@";
const DONE_HEADER = "=";
const TALLY_HEADER = "%";
const TALLY = "1";
const IN_PROCESS = "*";
const MATCH = "✓";
const MISS = "✗";
const COUNTED = "+";

export function selectionTape(fieldNames: string[], templates: TemplateDef[]): string[] {
  const blocks = templates.flatMap((t) => [HEADER + t.id, ...t.required]);
  return [...fieldNames, SEPARATOR, ...blocks, END];
}

export function selectionMachine(): TuringMachine {
  const go = (next: string, write: string, move: Transition["move"]): Transition => ({ next, write, move });

  return {
    start: "q_inicio",
    accept: ["q_fin"],
    delta(state, symbol) {
      const bracket = state.indexOf("[");
      const family = bracket === -1 ? state : state.slice(0, bracket);
      const param = bracket === -1 ? "" : state.slice(bracket + 1, state.length - 1);
      switch (family) {
        case "q_inicio":
          return go(symbol === SEPARATOR ? "q_siguiente" : "q_inicio", symbol, "R");
        case "q_siguiente":
          if (symbol === END) return go("q_contar_ini", symbol, "L");
          if (symbol.startsWith(HEADER)) return go(state, symbol, "R");
          return go(`q_volver[${symbol}]`, IN_PROCESS + symbol, "L");
        case "q_volver":
          return go(symbol === SEPARATOR ? `q_comparar[${param}]` : state, symbol, "L");
        case "q_comparar":
          if (symbol === param) return go(`q_encontrado[${param}]`, symbol, "R");
          if (symbol === BLANK) return go(`q_ausente[${param}]`, symbol, "R");
          return go(state, symbol, "L");
        case "q_encontrado":
        case "q_ausente":
          if (symbol !== IN_PROCESS + param) return go(state, symbol, "R");
          return go("q_siguiente", (family === "q_encontrado" ? MATCH : MISS) + param, "R");
        case "q_contar_ini":
          return go(symbol === SEPARATOR ? "q_contar" : state, symbol, symbol === SEPARATOR ? "R" : "L");
        case "q_contar":
          if (symbol === END) return go("q_fin", symbol, "S");
          if (symbol.startsWith(HEADER))
            return go(`q_anotar[${TALLY_HEADER}${symbol.slice(1)}]`, DONE_HEADER + symbol.slice(1), "R");
          if (symbol.startsWith(MATCH)) return go(`q_anotar[${TALLY}]`, COUNTED + symbol.slice(1), "R");
          return go(state, symbol, "R");
        case "q_anotar":
          return symbol === BLANK ? go("q_retorno", param, "L") : go(state, symbol, "R");
        case "q_retorno":
          if (symbol.startsWith(COUNTED) || symbol.startsWith(DONE_HEADER)) return go("q_contar", symbol, "R");
          return go(state, symbol, "L");
        default:
          return null;
      }
    },
  };
}

/** Runs the selection machine and reads the tallies from the final tape. */
// Materia §5.4: la simulación compara campos y escribe conteos unarios en la cinta.
// ATENCIÓN: readTallies interpreta esa salida y el bucle con isBetter elige
// la plantilla en TypeScript. El argmáximo NO se calcula dentro de la MT actual.
export function selectTemplate(
  fieldNames: string[],
  templates: TemplateDef[],
  options: RunOptions = {},
): SelectionResult {
  const run = runMachine(selectionMachine(), selectionTape(fieldNames, templates), {
    outputSeparator: " ",
    ...options,
  });
  const tallies = readTallies(run.output.split(" "));
  const scores: SelectionResult["scores"] = {};
  for (const t of templates) scores[t.id] = { matched: tallies.get(t.id) ?? 0, total: t.required.length };

  let best: TemplateDef | null = null;
  for (const t of templates) {
    if (best === null || isBetter(scores[t.id], scores[best.id])) best = t;
  }
  const bestScore = best ? scores[best.id] : undefined;
  if (!run.accepted || !best || !bestScore || bestScore.matched === 0) {
    return { templateId: null, scores, tie: false, low: true, run };
  }
  // Equal proportions only matter while the best template is incomplete; if both are complete,
  // the one covering more fields (already preferred by isBetter) is the right choice.
  const complete = bestScore.matched === bestScore.total;
  const tie = !complete && templates.some((t) => t.id !== best.id && sameRatio(scores[t.id], bestScore));
  const low = 2 * bestScore.matched < bestScore.total;
  return { templateId: best.id, scores, tie, low, run };
}

type Score = { matched: number; total: number };

/** Higher proportion wins (cross-multiplication, no floats); equal proportion → more matches wins. */
function isBetter(a: Score | undefined, b: Score | undefined): boolean {
  if (!a || !b) return false;
  const left = a.matched * b.total;
  const right = b.matched * a.total;
  return left > right || (left === right && a.matched > b.matched);
}

function sameRatio(a: Score | undefined, b: Score): boolean {
  return a !== undefined && a.matched * b.total === b.matched * a.total;
}

/** Reads "%X 1 1 … %Y 1 …" after the end mark into a count per template. */
function readTallies(cells: string[]): Map<string, number> {
  const tallies = new Map<string, number>();
  let current: string | null = null;
  for (const cell of cells.slice(cells.indexOf(END) + 1)) {
    if (cell.startsWith(TALLY_HEADER)) {
      current = cell.slice(1);
      tallies.set(current, 0);
    } else if (cell === TALLY && current !== null) {
      tallies.set(current, (tallies.get(current) ?? 0) + 1);
    }
  }
  return tallies;
}

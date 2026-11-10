import type { SelectionResult, TemplateDef } from "../types";
import { END } from "./fill";
import { BLANK, runMachine, type RunOptions, type Transition, type TuringMachine } from "./machine";

// The tape starts with extracted fields and required fields per template.
// Comparisons mark each required field. A second pass writes unary tallies.
// The final pass reads those tallies and writes RESULT:<id or ->:<tie>:<low>.
const SEPARATOR = "#";
const HEADER = "@";
const DONE_HEADER = "=";
const TALLY_HEADER = "%";
const TALLY = "1";
const IN_PROCESS = "*";
const MATCH = "✓";
const MISS = "✗";
const COUNTED = "+";
const RESULT = "RESULT:";
const DOMAINS = ["", "PASTOREO", "CULTIVO", "MIXTA"] as const;

interface Tally {
  id: string;
  total: number;
  matched: number;
}

function readTallyCell(tallies: Tally[], symbol: string): void {
  if (symbol.startsWith(TALLY_HEADER)) {
    const [id, total] = symbol.slice(1).split(":");
    if (id && total !== undefined) tallies.push({ id, total: Number(total), matched: 0 });
  } else if (symbol === TALLY) {
    const last = tallies.at(-1);
    if (last) last.matched++;
  }
}

function verdict(tallies: Tally[], domain?: string): string {
  let best: Tally | undefined;
  let tie = false;
  for (const tally of tallies) {
    if (tally.matched === 0 || (domain !== undefined && tally.id !== domain)) continue;
    const difference = best ? tally.matched * best.total - best.matched * tally.total : 1;
    const bothComplete = best && tally.matched === tally.total && best.matched === best.total;
    if (difference > 0 || (difference === 0 && bothComplete && tally.total > (best?.total ?? 0))) {
      best = tally;
      tie = false;
    } else if (difference === 0 && (!bothComplete || tally.total === best?.total)) {
      tie = true;
    }
  }
  const low = !best || 2 * best.matched < best.total;
  return `${RESULT}${tie ? "-" : (best?.id ?? "-")}:${Number(tie)}:${Number(low)}`;
}

export function selectionTape(fieldNames: string[], templates: TemplateDef[]): string[] {
  const blocks = templates.flatMap((t) => [HEADER + t.id + ":" + t.required.length, ...t.required]);
  return [...fieldNames, SEPARATOR, ...blocks, END];
}

export function selectionMachine(requireDomain = false): TuringMachine {
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
          if (symbol === END) return requireDomain
            ? go("q_dominio[0]", symbol, "L")
            : go("q_resultado[[[]]]", symbol, "R");
          if (symbol.startsWith(HEADER))
            return go(`q_anotar[${TALLY_HEADER}${symbol.slice(1)}]`, DONE_HEADER + symbol.slice(1), "R");
          if (symbol.startsWith(MATCH)) return go(`q_anotar[${TALLY}]`, COUNTED + symbol.slice(1), "R");
          return go(state, symbol, "R");
        case "q_anotar":
          return symbol === BLANK ? go("q_retorno", param, "L") : go(state, symbol, "R");
        case "q_retorno":
          if (symbol.startsWith(COUNTED) || symbol.startsWith(DONE_HEADER)) return go("q_contar", symbol, "R");
          return go(state, symbol, "L");
        case "q_dominio": {
          if (symbol === BLANK) return go(`q_buscar_conteos[${param}]`, symbol, "R");
          const mask = Number(param) | (symbol === "tipo_animal" ? 1 : symbol === "cultivo" ? 2 : 0);
          return go(`q_dominio[${mask}]`, symbol, "L");
        }
        case "q_buscar_conteos":
          return symbol === END
            ? go(`q_resultado[${JSON.stringify([[], DOMAINS[Number(param)]])}]`, symbol, "R")
            : go(state, symbol, "R");
        case "q_resultado": {
          const [tallies, domain] = JSON.parse(param) as [Tally[], string?];
          if (symbol === BLANK) return go("q_fin", verdict(tallies, domain), "S");
          readTallyCell(tallies, symbol);
          const data = domain === undefined ? [tallies] : [tallies, domain];
          return go(`q_resultado[${JSON.stringify(data)}]`, symbol, "R");
        }
        default:
          return null;
      }
    },
  };
}

// The control writes the verdict. The wrapper only decodes the machine's output.
export function selectTemplate(
  fieldNames: string[],
  templates: TemplateDef[],
  options: RunOptions & { requireDomain?: boolean } = {},
): SelectionResult {
  const { requireDomain, ...runOptions } = options;
  const run = runMachine(selectionMachine(requireDomain), selectionTape(fieldNames, templates), {
    ...runOptions,
    outputSeparator: " ",
  });
  const cells = run.output.split(" ");
  const tallies: Tally[] = [];
  for (const symbol of cells.slice(cells.indexOf(END) + 1)) readTallyCell(tallies, symbol);
  const scores: SelectionResult["scores"] = {};
  for (const template of templates) {
    const tally = tallies.find(({ id }) => id === template.id);
    scores[template.id] = { matched: tally?.matched ?? 0, total: tally?.total ?? template.required.length };
  }
  const result = cells.at(-1);
  if (!run.accepted || !result?.startsWith(RESULT)) {
    return { templateId: null, scores, tie: false, low: true, run };
  }
  const [, winner, tie, low] = result.split(":");
  const templateId = templates.find(({ id }) => id === winner)?.id ?? null;
  return { templateId, scores, tie: tie === "1", low: low === "1", run };
}

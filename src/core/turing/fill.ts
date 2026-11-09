import type { TuringRun } from "../types";
import { BLANK, runMachine, type RunOptions, type Transition, type TuringMachine } from "./machine";

/** End-of-template mark; q_buscar accepts when it reaches it. */
export const END = "⊣";

const OPEN = "{{";
const CLOSE = "}}";
const SECTION_OPEN = "[[?";
const SECTION_END = "[[/";
const SECTION_CLOSE = "]]";
const MARKERS = [SECTION_OPEN, SECTION_END, SECTION_CLOSE, OPEN, CLOSE];

export interface FillResult {
  run: TuringRun;
  /** Fields left as `{{campo}}` because they had no value (in order of appearance). */
  pending: string[];
}

/** Splits a template into tape cells: one cell per character, markers such as "{{" are a single cell. */
export function templateToTape(template: string): string[] {
  const cells: string[] = [];
  let i = 0;
  while (i < template.length) {
    const marker = MARKERS.find((m) => template.startsWith(m, i));
    const cell = marker ?? template.charAt(i);
    cells.push(cell);
    i += cell.length;
  }
  cells.push(END);
  return cells;
}

/**
 * Fill machine (§5.3). Simple field markers:
 *   q_buscar    moves right until "{{"
 *   q_leer[n]   reads the field name n up to "}}" (a missing field is left pending)
 *   q_borrar[n] goes back erasing "}}", the name and "{{" (writes blanks)
 *   q_escribir[n] writes the value of n in the cell where "{{" was, then returns to q_buscar
 *   q_fin       reached at the end mark: accepts
 * Optional sections `[[?n]] … [[/n]]` (not nested) use helper states:
 *   q_seccion[n] erases and reads "[[?n]]"; if n has a value the section text is kept,
 *   otherwise q_saltar[n] erases everything up to "[[/"; q_cerrar erases the closing "n]]".
 */
// Materia §5.3: seguir q_buscar → q_leer → q_borrar → q_escribir.
// Simplificación del prototipo: el parámetro [nombre] se acumula en el estado
// y el valor completo se escribe como un símbolo compuesto en una celda.
// Una MT clásica uniforme exigiría control finito y una codificación fija
// de nombres y valores en la cinta, en lugar de estas cadenas arbitrarias.
export function fillMachine(values: Record<string, string>): TuringMachine {
  const has = (name: string) => Object.hasOwn(values, name);
  const isNameChar = (symbol: string) => symbol.length === 1 && symbol !== END && symbol !== BLANK;
  const go = (next: string, write: string, move: Transition["move"]): Transition => ({ next, write, move });

  return {
    start: "q_buscar",
    accept: ["q_fin"],
    delta(state, symbol) {
      const [family, name] = splitState(state);
      switch (family) {
        case "q_buscar":
          if (symbol === OPEN) return go("q_leer[]", symbol, "R");
          if (symbol === SECTION_OPEN) return go("q_seccion[]", BLANK, "R");
          if (symbol === SECTION_END) return go("q_cerrar", BLANK, "R");
          if (symbol === END) return go("q_fin", BLANK, "S");
          return go("q_buscar", symbol, "R");
        case "q_leer":
          if (symbol === CLOSE) return has(name) ? go(`q_borrar[${name}]`, BLANK, "L") : go("q_buscar", symbol, "R");
          return isNameChar(symbol) ? go(`q_leer[${name}${symbol}]`, symbol, "R") : null;
        case "q_borrar":
          if (symbol === OPEN) return go(`q_escribir[${name}]`, BLANK, "S");
          return go(state, BLANK, "L");
        case "q_escribir":
          return go("q_buscar", values[name] ?? "", "R");
        case "q_seccion":
          if (symbol === SECTION_CLOSE) return go(has(name) ? "q_buscar" : `q_saltar[${name}]`, BLANK, "R");
          return isNameChar(symbol) ? go(`q_seccion[${name}${symbol}]`, BLANK, "R") : null;
        case "q_saltar":
          if (symbol === SECTION_END) return go("q_cerrar", BLANK, "R");
          return symbol === END ? null : go(state, BLANK, "R");
        case "q_cerrar":
          if (symbol === SECTION_CLOSE) return go("q_buscar", BLANK, "R");
          return symbol === END ? null : go(state, BLANK, "R");
        default:
          return null;
      }
    },
  };
}

/** Runs the fill machine over a template body. Output = tape without blanks. */
export function fillTemplate(template: string, values: Record<string, string>, options: RunOptions = {}): FillResult {
  const run = runMachine(fillMachine(values), templateToTape(template), options);
  return { run, pending: findPending(run.output) };
}

/** `q_leer[raza]` → ["q_leer", "raza"]. */
function splitState(state: string): [string, string] {
  const bracket = state.indexOf("[");
  if (bracket === -1) return [state, ""];
  return [state.slice(0, bracket), state.slice(bracket + 1, state.length - 1)];
}

function findPending(text: string): string[] {
  const names: string[] = [];
  let from = text.indexOf(OPEN);
  while (from !== -1) {
    const close = text.indexOf(CLOSE, from);
    if (close === -1) break;
    const name = text.slice(from + OPEN.length, close);
    if (!names.includes(name)) names.push(name);
    from = text.indexOf(OPEN, close);
  }
  return names;
}

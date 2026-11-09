import type { TapeSnapshot, TuringRun } from "../types";

/**
 * Generic single-tape Turing machine.
 *
 * Tape alphabet: every cell holds a string. Cells are usually one character, but a symbol may be
 * longer ("{{", "[[?", a field name, a field value): the alphabet is still finite because it is
 * built from the given template and field map. The tape is infinite in both directions (blank cells
 * are added on demand).
 *
 * States are strings. A state like `q_leer[raza]` belongs to the family `q_leer`: the bracketed part
 * is information remembered in the finite control (e.g. the field name read so far).
 */
export const BLANK = "□";

export type Move = "L" | "R" | "S";

export interface Transition {
  next: string;
  write: string;
  move: Move;
}

export interface TuringMachine {
  start: string;
  accept: string[];
  /** δ(state, symbol). `null` means "no transition": the machine halts and rejects. */
  delta(state: string, symbol: string): Transition | null;
}

export interface RunOptions {
  /** Hard limit on the number of transitions (default 200 000). */
  maxSteps?: number;
  /** Also take a snapshot every N steps (0 = only on state-family changes). */
  sampleEvery?: number;
  /** Text used to join the non-blank cells into `output` (default ""). */
  outputSeparator?: string;
}

/** Name of a state without its bracketed parameter: `q_leer[raza]` → `q_leer`. */
export function stateFamily(state: string): string {
  const bracket = state.indexOf("[");
  return bracket === -1 ? state : state.slice(0, bracket);
}

export function runMachine(machine: TuringMachine, input: string[], options: RunOptions = {}): TuringRun {
  const maxSteps = options.maxSteps ?? 200_000;
  const sampleEvery = options.sampleEvery ?? 0;
  const tape = input.length > 0 ? [...input] : [BLANK];
  const snapshots: TapeSnapshot[] = [];
  let head = 0;
  let state = machine.start;
  let steps = 0;

  const snap = (note?: string) =>
    snapshots.push({ step: steps, state, head, tape: [...tape], ...(note ? { note } : {}) });
  snap("inicio");

  while (!machine.accept.includes(state)) {
    if (steps >= maxSteps) {
      snap(`maxSteps alcanzado (${maxSteps})`);
      return finish(false);
    }
    const symbol = tape[head] ?? BLANK;
    const transition = machine.delta(state, symbol);
    if (transition === null) {
      snap(`sin transición para (${state}, ${symbol}): rechaza`);
      return finish(false);
    }
    const previousFamily = stateFamily(state);
    tape[head] = transition.write;
    state = transition.next;
    head = moveHead(transition.move);
    steps++;
    if (stateFamily(state) !== previousFamily || (sampleEvery > 0 && steps % sampleEvery === 0)) snap();
  }
  return finish(true);

  function moveHead(move: Move): number {
    if (move === "S") return head;
    if (move === "R") {
      if (head + 1 >= tape.length) tape.push(BLANK);
      return head + 1;
    }
    if (head === 0) {
      tape.unshift(BLANK);
      return 0;
    }
    return head - 1;
  }

  function finish(accepted: boolean): TuringRun {
    const output = tape.filter((cell) => cell !== BLANK).join(options.outputSeparator ?? "");
    return { accepted, steps, snapshots, output };
  }
}

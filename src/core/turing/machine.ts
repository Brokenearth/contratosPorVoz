import type { TapeSnapshot, TuringRun } from "../types";

/**
 * Generic single-tape Turing machine.
 *
 * Abstracción del prototipo: una celda puede contener una cadena completa y
 * los estados pueden incluir parámetros como q_leer[raza]. Se muestran las
 * operaciones de lectura, escritura y movimiento, pero eso no establece por
 * sí solo conjuntos Q y Γ finitos y fijos para todas las entradas posibles.
 * fill.ts y selection.ts explican los límites de las máquinas de dominio.
 * La cinta se amplía bajo demanda en ambos sentidos, dentro de los límites
 * de memoria del equipo; maxSteps limita las transiciones de una ejecución.
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

// Materia §5.3: este es el ciclo de simulación, no una animación de la interfaz.
// δ(estado, símbolo leído) devuelve escritura, estado siguiente y movimiento.
// Más abajo se ejecutan esas tres operaciones sobre tape, state y head.
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

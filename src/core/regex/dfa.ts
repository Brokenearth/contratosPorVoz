import { type Automaton, lambdaClosure, move, stateIndex } from "./nfa";

export interface Dfa extends Automaton {
  /** NFA states contained in each DFA state, e.g. D0 → [q0, q1, q2]. */
  subsets: Record<string, string[]>;
}

/** Subset construction: NFA-λ → DFA (only reachable states; missing transitions mean rejection). */
export function subsetConstruction(nfa: Automaton): Dfa {
  const sortStates = (states: Set<string>): string[] => [...states].sort((a, b) => stateIndex(a) - stateIndex(b));
  const nameByKey = new Map<string, string>();
  const subsets: Record<string, string[]> = {};
  const pending: string[][] = [];

  const nameFor = (states: Set<string>): string => {
    const sorted = sortStates(states);
    const key = sorted.join(",");
    const existing = nameByKey.get(key);
    if (existing !== undefined) return existing;
    const name = `D${nameByKey.size}`;
    nameByKey.set(key, name);
    subsets[name] = sorted;
    pending.push(sorted);
    return name;
  };

  const initial = nameFor(lambdaClosure(nfa, [nfa.initial]));
  const transitions: Automaton["transitions"] = [];
  for (let current = pending.shift(); current !== undefined; current = pending.shift()) {
    const from = nameFor(new Set(current));
    for (const symbol of nfa.alphabet) {
      const reached = move(nfa, current, symbol);
      if (reached.size > 0) transitions.push({ from, symbol, to: nameFor(lambdaClosure(nfa, reached)) });
    }
  }

  const states = Object.keys(subsets);
  return {
    states,
    alphabet: [...nfa.alphabet],
    transitions,
    initial,
    accepting: states.filter((name) => (subsets[name] ?? []).some((q) => nfa.accepting.includes(q))),
    subsets,
  };
}

const tableCache = new WeakMap<Automaton, Map<string, string>>();

function next(dfa: Automaton, state: string, symbol: string): string | undefined {
  let table = tableCache.get(dfa);
  if (table === undefined) {
    table = new Map(dfa.transitions.map((t) => [`${t.from} ${t.symbol}`, t.to]));
    tableCache.set(dfa, table);
  }
  return table.get(`${state} ${symbol}`);
}

export interface DfaRun {
  accepted: boolean;
  /** States visited, starting with the initial state. */
  states: string[];
}

/** Runs the DFA over the whole input. */
export function runDfa(dfa: Automaton, input: string): DfaRun {
  const states = [dfa.initial];
  let current: string | undefined = dfa.initial;
  for (let i = 0; i < input.length && current !== undefined; i++) {
    current = next(dfa, current, input.charAt(i));
    if (current !== undefined) states.push(current);
  }
  return { accepted: current !== undefined && dfa.accepting.includes(current), states };
}

export interface Match {
  /** Length of the longest accepted prefix (0 when nothing is accepted). */
  length: number;
  /** States visited up to the end of that prefix. */
  states: string[];
}

/** Longest prefix of `input` starting at `start` accepted by the DFA (maximal munch). */
export function longestMatch(dfa: Automaton, input: string, start: number): Match {
  const states = [dfa.initial];
  let best: Match = { length: 0, states: [] };
  let current: string | undefined = dfa.initial;
  for (let i = start; i < input.length; i++) {
    current = next(dfa, current, input.charAt(i));
    if (current === undefined) break;
    states.push(current);
    if (dfa.accepting.includes(current)) best = { length: i - start + 1, states: [...states] };
  }
  return best;
}

import type { RegexNode } from "./parser";

/** Symbol used for empty (λ) transitions. */
export const LAMBDA = "λ";

export interface Transition {
  from: string;
  symbol: string;
  to: string;
}

/** Plain automaton structure shared by NFA-λ and DFA (easy to render in the UI or docs). */
export interface Automaton {
  states: string[];
  alphabet: string[];
  transitions: Transition[];
  initial: string;
  accepting: string[];
}

interface Fragment {
  start: number;
  accept: number;
}

interface Edge {
  from: number;
  symbol: string;
  to: number;
}

/** Thompson construction: regex AST → NFA-λ with states q0..qn (q0 is the initial state). */
// Materia §5.1: Thompson une fragmentos con transiciones λ para construir el AFN.
// Mostrar los casos concat, union y star: cada uno corresponde a un operador de ER.
export function thompson(node: RegexNode): Automaton {
  let stateCount = 0;
  const edges: Edge[] = [];
  const newState = (): number => stateCount++;
  const edge = (from: number, symbol: string, to: number): void => {
    edges.push({ from, symbol, to });
  };

  function build(current: RegexNode): Fragment {
    switch (current.kind) {
      case "char":
      case "lambda": {
        const start = newState();
        const accept = newState();
        edge(start, current.kind === "char" ? current.char : LAMBDA, accept);
        return { start, accept };
      }
      case "concat": {
        const fragments = current.parts.map(build);
        for (let i = 0; i + 1 < fragments.length; i++) {
          edge(fragmentAt(fragments, i).accept, LAMBDA, fragmentAt(fragments, i + 1).start);
        }
        return { start: fragmentAt(fragments, 0).start, accept: fragmentAt(fragments, fragments.length - 1).accept };
      }
      case "union": {
        const start = newState();
        const fragments = current.options.map(build);
        const accept = newState();
        for (const fragment of fragments) {
          edge(start, LAMBDA, fragment.start);
          edge(fragment.accept, LAMBDA, accept);
        }
        return { start, accept };
      }
      case "star": {
        const start = newState();
        const inner = build(current.child);
        const accept = newState();
        edge(start, LAMBDA, inner.start);
        edge(start, LAMBDA, accept);
        edge(inner.accept, LAMBDA, inner.start);
        edge(inner.accept, LAMBDA, accept);
        return { start, accept };
      }
      case "plus":
        return build({ kind: "concat", parts: [current.child, { kind: "star", child: current.child }] });
      case "optional":
        return build({ kind: "union", options: [current.child, { kind: "lambda" }] });
    }
  }

  const root = build(node);
  return renumber(edges, root);
}

function fragmentAt(fragments: Fragment[], index: number): Fragment {
  const fragment = fragments[index];
  if (fragment === undefined) throw new Error(`Fragmento inexistente: ${index}`);
  return fragment;
}

/** Renames states in breadth-first order from the start state so the result reads q0, q1, ... */
function renumber(edges: Edge[], root: Fragment): Automaton {
  const names = new Map<number, string>([[root.start, "q0"]]);
  const queue = [root.start];
  for (let i = 0; i < queue.length; i++) {
    for (const e of edges) {
      if (e.from === queue[i] && !names.has(e.to)) {
        names.set(e.to, `q${names.size}`);
        queue.push(e.to);
      }
    }
  }
  const nameOf = (state: number): string => names.get(state) ?? `q${state}`;
  const transitions = edges
    .map((e) => ({ from: nameOf(e.from), symbol: e.symbol, to: nameOf(e.to) }))
    .sort((a, b) => stateIndex(a.from) - stateIndex(b.from) || stateIndex(a.to) - stateIndex(b.to));
  const alphabet = [...new Set(edges.map((e) => e.symbol).filter((s) => s !== LAMBDA))].sort();
  return {
    states: [...names.values()].sort((a, b) => stateIndex(a) - stateIndex(b)),
    alphabet,
    transitions,
    initial: "q0",
    accepting: [nameOf(root.accept)],
  };
}

/** Numeric part of a state name such as "q12" or "D3". */
export function stateIndex(name: string): number {
  return Number(name.slice(1));
}

const adjacencyCache = new WeakMap<Automaton, Map<string, Transition[]>>();

function outgoing(nfa: Automaton, state: string): Transition[] {
  let adjacency = adjacencyCache.get(nfa);
  if (adjacency === undefined) {
    adjacency = new Map();
    for (const t of nfa.transitions) adjacency.set(t.from, [...(adjacency.get(t.from) ?? []), t]);
    adjacencyCache.set(nfa, adjacency);
  }
  return adjacency.get(state) ?? [];
}

/** λ-closure: every state reachable from `states` using only λ transitions. */
export function lambdaClosure(nfa: Automaton, states: Iterable<string>): Set<string> {
  const closure = new Set(states);
  const pending = [...closure];
  for (let state = pending.pop(); state !== undefined; state = pending.pop()) {
    for (const t of outgoing(nfa, state)) {
      if (t.symbol === LAMBDA && !closure.has(t.to)) {
        closure.add(t.to);
        pending.push(t.to);
      }
    }
  }
  return closure;
}

/** States reachable from `states` reading exactly `symbol` (no closure applied). */
export function move(nfa: Automaton, states: Iterable<string>, symbol: string): Set<string> {
  const result = new Set<string>();
  for (const state of states) {
    for (const t of outgoing(nfa, state)) if (t.symbol === symbol) result.add(t.to);
  }
  return result;
}

/** Direct NFA-λ simulation (used to check that the DFA is equivalent). */
export function nfaAccepts(nfa: Automaton, input: string): boolean {
  let current = lambdaClosure(nfa, [nfa.initial]);
  for (const symbol of input) current = lambdaClosure(nfa, move(nfa, current, symbol));
  return nfa.accepting.some((state) => current.has(state));
}

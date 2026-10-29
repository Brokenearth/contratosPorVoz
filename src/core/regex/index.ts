import { type Dfa, subsetConstruction } from "./dfa";
import { type Automaton, LAMBDA, thompson } from "./nfa";
import { type Definitions, type RegexNode, parseRegex } from "./parser";

export { type Definitions, type RegexNode, RegexSyntaxError, parseRegex } from "./parser";
export { type Automaton, type Transition, LAMBDA, lambdaClosure, move, nfaAccepts, thompson } from "./nfa";
export { type Dfa, type DfaRun, type Match, longestMatch, runDfa, subsetConstruction } from "./dfa";

export interface CompiledRegex {
  source: string;
  ast: RegexNode;
  nfa: Automaton;
  dfa: Dfa;
}

/** Full pipeline: course-notation regex → AST → NFA-λ (Thompson) → DFA (subsets). */
export function compileRegex(source: string, definitions: Definitions = {}): CompiledRegex {
  const ast = parseRegex(source, definitions);
  const nfa = thompson(ast);
  return { source, ast, nfa, dfa: subsetConstruction(nfa) };
}

/** Graphviz DOT text for an automaton; parallel edges are merged into one label. */
export function toDot(automaton: Automaton, name = "automata"): string {
  const labels = new Map<string, string[]>();
  for (const t of automaton.transitions) {
    const key = `"${t.from}" -> "${t.to}"`;
    labels.set(key, [...(labels.get(key) ?? []), t.symbol === LAMBDA ? "λ" : t.symbol]);
  }
  const lines = [
    `digraph "${name}" {`,
    "  rankdir=LR;",
    "  node [shape=circle];",
    '  "" [shape=none];',
    `  "" -> "${automaton.initial}";`,
    ...automaton.accepting.map((state) => `  "${state}" [shape=doublecircle];`),
    ...[...labels].map(([edge, symbols]) => `  ${edge} [label="${symbols.join(",")}"];`),
    "}",
  ];
  return lines.join("\n");
}

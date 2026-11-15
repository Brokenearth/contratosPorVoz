/** Generates example contracts and automata diagrams from the application core. */
import { DEMO_PHRASES, runPipeline } from "../src/core/pipeline";
import { getTokenAutomata, NAMED_DEFINITIONS } from "../src/core/lexer";
import { type Automaton, compileRegex, type Dfa, LAMBDA } from "../src/core/regex";
import type { Token } from "../src/core/types";

/** Largest automaton drawn as a Mermaid diagram (merged edges); bigger ones are shown only as a table. */
const MAX_DIAGRAM_EDGES = 90;
const DIGITS = "0123456789".split("");

const cell = (text: string): string => text.split("|").join("\\|");
const code = (text: string): string => "`" + cell(text) + "`";
const fence = (lang: string, body: string): string => "```" + lang + "\n" + body + "\n```";

function table(header: string[], rows: string[][]): string {
  const line = (cells: string[]): string => `| ${cells.join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join("\n");
}

// ---------------------------------------------------------------- automata

function symbolsOf(automaton: Automaton): string[] {
  const symbols = automaton.alphabet.filter((s) => s !== LAMBDA);
  return automaton.transitions.some((t) => t.symbol === LAMBDA) ? [...symbols, LAMBDA] : symbols;
}

function targets(automaton: Automaton, state: string, symbol: string): string[] {
  return automaton.transitions.filter((t) => t.from === state && t.symbol === symbol).map((t) => t.to);
}

function stateLabel(automaton: Automaton, state: string): string {
  const initial = state === automaton.initial ? "→" : "";
  const accepting = automaton.accepting.includes(state) ? "*" : "";
  return `${initial}${accepting}${state}`;
}

/** Transition matrix: one row per state, one column per symbol (→ initial, * accepting). */
function transitionTable(automaton: Automaton, dfa?: Dfa): string {
  const symbols = symbolsOf(automaton);
  const header = ["Estado", ...(dfa ? ["Subconjunto AFN"] : []), ...symbols.map(code)];
  const nondeterministic = automaton.transitions.some((t) => t.symbol === LAMBDA);
  const rows = automaton.states.map((state) => {
    const subset = dfa ? [`{${(dfa.subsets[state] ?? []).join(",")}}`] : [];
    const cells = symbols.map((symbol) => {
      const to = targets(automaton, state, symbol);
      if (to.length === 0) return "—";
      return nondeterministic ? `{${to.join(",")}}` : to.join(",");
    });
    return [stateLabel(automaton, state), ...subset, ...cells];
  });
  return table(header, rows);
}

function edgeLabel(symbols: string[]): string {
  const digits = DIGITS.every((d) => symbols.includes(d));
  const rest = digits ? symbols.filter((s) => !DIGITS.includes(s)) : symbols;
  return [...(digits ? ["DIGITO"] : []), ...rest.map((s) => (s === "." ? "punto" : s))].join(", ");
}

/** Parallel edges merged into one entry: "q0 --> q1" → ["0", "1", …]. */
function mergedEdges(automaton: Automaton): Map<string, string[]> {
  const edges = new Map<string, string[]>();
  for (const t of automaton.transitions) {
    const key = `${t.from} --> ${t.to}`;
    edges.set(key, [...(edges.get(key) ?? []), t.symbol]);
  }
  return edges;
}

/** Mermaid stateDiagram with parallel edges merged into one label. */
function mermaid(automaton: Automaton): string {
  const edges = mergedEdges(automaton);
  const lines = [
    "stateDiagram-v2",
    "  direction LR",
    `  [*] --> ${automaton.initial}`,
    ...[...edges].map(([edge, symbols]) => `  ${edge}: ${edgeLabel(symbols)}`),
    ...automaton.accepting.map((state) => `  ${state} --> [*]`),
  ];
  return fence("mermaid", lines.join("\n"));
}

function automatonSection(title: string, automaton: Automaton, dfa?: Dfa): string {
  const counts =
    `${automaton.states.length} estados, ${automaton.transitions.length} transiciones, ` +
    `alfabeto: {${automaton.alphabet.filter((s) => s !== LAMBDA).join(", ")}}.`;
  const diagram =
    mergedEdges(automaton).size <= MAX_DIAGRAM_EDGES
      ? mermaid(automaton)
      : `_Diagrama omitido por tamaño (más de ${MAX_DIAGRAM_EDGES} aristas); ver la tabla._`;
  return [`#### ${title}`, counts, diagram, transitionTable(automaton, dfa)].join("\n\n");
}

/**
 * Moore's partition refinement over the subset DFA (documentation only: the lexer runs the
 * subset DFA). A missing transition counts as going to an implicit dead state.
 */
export function minimize(dfa: Automaton): Automaton {
  const symbols = dfa.alphabet;
  const next = (state: string, symbol: string): string | undefined =>
    dfa.transitions.find((t) => t.from === state && t.symbol === symbol)?.to;
  let block = new Map(dfa.states.map((s) => [s, dfa.accepting.includes(s) ? "F" : "N"]));
  for (;;) {
    const signature = (s: string): string =>
      [
        block.get(s),
        ...symbols.map((a) => {
          const to = next(s, a);
          return to === undefined ? "-" : block.get(to);
        }),
      ].join("|");
    const ids = new Map<string, string>();
    const refined = new Map(
      dfa.states.map((s) => {
        const key = signature(s);
        if (!ids.has(key)) ids.set(key, String(ids.size));
        return [s, ids.get(key) ?? ""];
      }),
    );
    const stable = ids.size === new Set(block.values()).size;
    block = refined;
    if (stable) break;
  }
  // Name the blocks M0, M1, … in breadth-first order from the initial state.
  const names = new Map<string, string>();
  const order = [dfa.initial];
  for (let i = 0; i < order.length; i++) {
    const state = order[i] ?? "";
    const id = block.get(state) ?? "";
    if (names.has(id)) continue;
    names.set(id, `M${names.size}`);
    for (const a of symbols) {
      const to = next(state, a);
      if (to !== undefined) order.push(to);
    }
  }
  const nameOf = (s: string): string => names.get(block.get(s) ?? "") ?? s;
  const transitions = new Map<string, { from: string; symbol: string; to: string }>();
  for (const t of dfa.transitions) {
    const edge = { from: nameOf(t.from), symbol: t.symbol, to: nameOf(t.to) };
    transitions.set(`${edge.from} ${edge.symbol}`, edge);
  }
  const states = [...names.values()];
  return {
    states,
    alphabet: symbols,
    transitions: [...transitions.values()],
    initial: nameOf(dfa.initial),
    accepting: states.filter((m) => dfa.accepting.some((s) => nameOf(s) === m)),
  };
}

function regexSection(title: string, regex: string): string {
  const { nfa, dfa } = compileRegex(regex, NAMED_DEFINITIONS);
  return [
    `### ${title}`,
    fence("text", regex),
    automatonSection("AFN-λ (construcción de Thompson)", nfa),
    automatonSection("AFD (construcción de subconjuntos)", dfa, dfa),
    automatonSection("AFD mínimo (refinamiento de particiones de Moore)", minimize(dfa)),
  ].join("\n\n");
}

function tokenAutomataSection(name: string): string {
  return regexSection(`Token ${name} (definición real del analizador léxico)`, getTokenAutomata(name).regex);
}

const PROPOSAL_ANIMAL = "(vaca|toro|caballo|cabra|oveja|cerdo)(s|λ)";

const tokenStream = (tokens: Token[]): string => tokens.map((t) => `[${t.type}:${t.lexeme}]`).join(" ");

// ---------------------------------------------------------------- demo contracts

const DEMOS: { file: string; phrase: string }[] = [
  { file: "01-pastoreo", phrase: DEMO_PHRASES[0] ?? "" },
  { file: "02-cultivo", phrase: DEMO_PHRASES[3] ?? "" },
  { file: "03-mixta", phrase: DEMO_PHRASES[5] ?? "" },
];

function demoContract(phrase: string): string {
  const result = runPipeline(phrase);
  if (result.contract === null) throw new Error(`La frase de demo no generó contrato: ${result.question}`);
  const scores = Object.entries(result.selection.scores)
    .map(([id, s]) => `${id} ${s.matched}/${s.total}`)
    .join(" · ");
  return [
    "<!-- Generado por `pnpm docs:generate` a partir de la frase dictada; no editar a mano. -->",
    `> **Frase dictada:** ${phrase}`,
    ">",
    `> **Tokens:** ${tokenStream(result.lex.tokens)}`,
    ">",
    `> **Selección (MT):** ${scores} → ${result.template?.id ?? "ninguna"}`,
    "",
    "---",
    "",
    result.contract.output.trim(),
    "",
  ].join("\n");
}

// ---------------------------------------------------------------- entry point

function automataFile(): string {
  return [
    "# Autómatas generados por el código",
    "<!-- Generado por `pnpm docs:generate`; no editar a mano. -->",
    "Convenciones: `→` estado inicial, `*` estado de aceptación, `—` sin transición (rechazo). " +
      "En los diagramas, `DIGITO` agrupa las diez aristas 0–9.",
    regexSection("Construcción de Thompson para (s|λ)", "s|λ"),
    tokenAutomataSection("NUM"),
    tokenAutomataSection("NUM_MILES"),
    regexSection("ANIMAL de la propuesta (§5.1)", PROPOSAL_ANIMAL),
    tokenAutomataSection("ANIMAL"),
    tokenAutomataSection("MES"),
    "",
  ].join("\n\n");
}

export function generateDocs(): Record<string, string> {
  const files: Record<string, string> = { "docs/automatas.md": automataFile() };
  for (const demo of DEMOS) files[`docs/contratos-demo/${demo.file}.md`] = demoContract(demo.phrase);
  return files;
}

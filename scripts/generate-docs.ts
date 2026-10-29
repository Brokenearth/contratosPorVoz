/**
 * Builds the generated parts of the report (deliverable 2) and the demo contracts (deliverable 3)
 * using the REAL core code: regex → NFA (Thompson) → DFA (subsets), the grammar and its
 * prediction table, the pushdown-automaton trace and both Turing machines.
 *
 * Pure module: it only returns text. `scripts/docs-runner.mjs` writes it to disk
 * (run it with `pnpm docs:generate`).
 */
import { DEMO_PHRASES, runPipeline } from "../src/core/pipeline";
import { getTokenAutomata, NAMED_DEFINITIONS, tokenize, TOKEN_DEFINITIONS } from "../src/core/lexer";
import { formatGrammar, formatProduction, grammar, parseContract, parseFrom, PREDICT } from "../src/core/parser";
import { productionOf } from "../src/core/parser/grammar";
import { type Automaton, compileRegex, type Dfa, LAMBDA } from "../src/core/regex";
import { extractedFieldNames, TEMPLATES } from "../src/core/templates";
import { fillTemplate, selectionTape, selectTemplate } from "../src/core/turing";
import type { ParseTree, TapeSnapshot, Token, TuringRun } from "../src/core/types";

export interface GeneratedDocs {
  /** Whole files, keyed by path relative to the repo root. */
  files: Record<string, string>;
  /** Blocks pasted into docs/informe.md between `<!-- gen:KEY -->` and `<!-- /gen:KEY -->`. */
  fragments: Record<string, string>;
}

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

function tokenTable(): string {
  const named = Object.entries(NAMED_DEFINITIONS).map(([name, regex]) => [name, "(auxiliar)", "", code(regex)]);
  const tokens = TOKEN_DEFINITIONS.map((d) => {
    const { nfa, dfa } = compileRegex(d.regex, NAMED_DEFINITIONS);
    const sizes = `${nfa.states.length} / ${dfa.states.length} / ${minimize(dfa).states.length}`;
    return [d.name, d.type, sizes, code(d.regex)];
  });
  return table(["Nombre", "Tipo de token", "Estados AFN / AFD / AFD mín.", "Expresión regular"], [...named, ...tokens]);
}

// ---------------------------------------------------------------- lexer and parser

const tokenStream = (tokens: Token[]): string => tokens.map((t) => `[${t.type}:${t.lexeme}]`).join(" ");

function lexTrace(text: string): string {
  const lex = tokenize(text);
  const rows = lex.trace.map((step, i) => {
    const token = lex.tokens[i];
    return [String(step.position), code(token?.lexeme ?? "?"), step.tokenType ?? "error", step.dfaStates.join(" → ")];
  });
  return table(["Posición", "Lexema", "Token", "Estados del AFD ganador"], rows);
}

function pdaTable(start: string, text: string): string {
  const result = parseFrom(start, tokenize(text).tokens);
  const rows = result.trace.map((step, i) => [
    String(i),
    code(step.input || "ε"),
    cell(step.action),
    code(step.symbols.join(" ") || "ε"),
    code(step.stack.join(" ")),
  ]);
  const verdict = result.ok ? "**ACEPTA**" : `**RECHAZA**: ${result.errors.join(" ")}`;
  return [
    table(["#", "Entrada restante", "Acción", "Pila de símbolos (tope a la derecha)", "Pila de anidación"], rows),
    `Resultado: ${verdict}`,
  ].join("\n\n");
}

function markerHistory(text: string): string {
  const result = parseFrom("LISTA", tokenize(text).tokens);
  const history: string[][] = [];
  for (const step of result.trace) {
    const view = step.stack.join(" ");
    const last = history[history.length - 1];
    if (last?.[1] !== view) history.push([step.action, view]);
  }
  history.push([result.ok ? "fin de entrada, pila = Z0 → ACEPTA" : "RECHAZA", "Z0"]);
  return table(
    ["Evento", "Pila de anidación (tope a la derecha)"],
    history.map(([event, view]) => [cell(event ?? ""), code(view ?? "")]),
  );
}

function treeText(tree: ParseTree | null, indent = ""): string {
  if (tree === null) return "(sin árbol)";
  const label = tree.token ? `${tree.symbol} = "${tree.token.lexeme}"` : tree.symbol;
  const children =
    tree.children.length === 0 && !tree.token && grammar.nonterminals.includes(tree.symbol)
      ? [`${indent}  λ`]
      : tree.children.map((child) => treeText(child, indent + "  "));
  return [`${indent}${label}`, ...children].join("\n");
}

function predictionTable(): string {
  const rows = Object.entries(PREDICT).flatMap(([head, entries]) =>
    entries.map((entry) => [head, code(entry.when.join(" ")), code(formatProduction(productionOf(head, entry.use)))]),
  );
  return table(["No terminal", "Anticipación (1–2 tokens)", "Producción elegida"], rows);
}

const PHRASES_55 = [
  "arriendo el lote 20 para 20 toros gir por 30 días",
  "los 20 toros gir se arriendan en el lote 20 por 30 días",
  "por 30 días, lote 20, 20 toros gir",
];

function sameFields(): string {
  const rows = PHRASES_55.map((phrase) => {
    const result = parseContract(tokenize(phrase).tokens);
    return [code(phrase), result.ok ? "acepta" : "rechaza", code(JSON.stringify(result.fields))];
  });
  return table(["Frase", "AP", "Campos extraídos"], rows);
}

// ---------------------------------------------------------------- Turing machines

function tapeLine(snapshot: TapeSnapshot, radius = 0): string {
  const from = radius > 0 ? Math.max(0, snapshot.head - radius) : 0;
  const to = radius > 0 ? snapshot.head + radius : snapshot.tape.length;
  return snapshot.tape
    .slice(from, to)
    .map((symbol, i) => (from + i === snapshot.head ? `[${symbol}]` : symbol))
    .join(" ");
}

function snapshotsBlock(run: TuringRun, radius: number, first: number, last: number): string {
  const pick =
    run.snapshots.length <= first + last
      ? run.snapshots
      : [...run.snapshots.slice(0, first), null, ...run.snapshots.slice(-last)];
  const lines = pick.map((s) =>
    s === null
      ? "…"
      : `${s.state.padEnd(24)} cabeza=${String(s.head).padStart(3)}  ${tapeLine(s, radius)}${s.note ? `   (${s.note})` : ""}`,
  );
  const summary =
    `${run.accepted ? "ACEPTA" : "RECHAZA"} en ${run.steps} pasos; ${run.snapshots.length} instantáneas ` +
    "(una por cada cambio de familia de estado).";
  return [fence("text", lines.join("\n")), summary].join("\n\n");
}

/** Field names of the §5.4 example, written with the names the templates declare. */
const SELECTION_54 = ["lote", "hectareas", "tipo_animal", "cantidad_animales", "raza", "uso"];

function selectionSection(): string {
  const result = selectTemplate(SELECTION_54, TEMPLATES);
  const rows = TEMPLATES.map((t) => {
    const score = result.scores[t.id];
    return [t.id, code(t.required.join(", ")), `${score?.matched ?? 0} de ${score?.total ?? 0}`];
  });
  return [
    "Cinta inicial:",
    fence("text", selectionTape(SELECTION_54, TEMPLATES).join(" ")),
    table(["Plantilla", "Campos requeridos (marcadores)", "Coincidencias"], rows),
    `Plantilla elegida: **${result.templateId ?? "ninguna"}** (empate: ${result.tie ? "sí" : "no"}, ` +
      `coincidencia baja: ${result.low ? "sí" : "no"}).`,
    "Traza muestreada de la MT de selección (ventana de ±5 celdas, cabeza entre corchetes):",
    snapshotsBlock(result.run, 5, 12, 4),
    "Cola de la cinta final (conteo unario por plantilla):",
    fence("text", result.run.output.slice(result.run.output.indexOf("⊣"))),
  ].join("\n\n");
}

const FILL_TEMPLATE =
  "El ARRENDATARIO {{arrendatario}} pagará {{valor}}.[[?insumos]] Los insumos los aporta {{insumos}}.[[/insumos]] Fin.";
const FILL_VALUES = { arrendatario: "Ana Gómez", valor: "$ 6.000.000" };

function fillSection(): string {
  const result = fillTemplate(FILL_TEMPLATE, FILL_VALUES);
  return [
    "Plantilla en la cinta (los marcadores `{{`, `}}`, `[[?`, `[[/`, `]]` ocupan una sola celda):",
    fence("text", FILL_TEMPLATE),
    `Valores: ${code(JSON.stringify(FILL_VALUES))} (sin \`insumos\`, así que su sección opcional se borra).`,
    "Traza muestreada (ventana de ±8 celdas alrededor de la cabeza, □ = blanco):",
    snapshotsBlock(result.run, 8, 14, 4),
    "Salida (cinta sin blancos):",
    fence("text", result.run.output),
  ].join("\n\n");
}

const PHRASE_6 =
  "arriendo lote La Esperanza de 5 hectáreas para 20 vacas de raza holstein para producción de leche por 12 meses";

function clauseSection(): string {
  const result = runPipeline(PHRASE_6, {}, { force: true });
  const output = result.contract?.output ?? "";
  const clause = output.split("\n").find((line) => line.includes("SEGUNDA")) ?? "(no encontrada)";
  return [
    fence("text", tokenStream(result.lex.tokens)),
    `Plantilla: **${result.template?.id ?? "ninguna"}**; campos faltantes: ${result.missing.join(", ") || "ninguno"}.`,
    `> ${clause}`,
  ].join("\n\n");
}

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

export function generateDocs(): GeneratedDocs {
  const num = compileRegex(getTokenAutomata("NUM").regex, NAMED_DEFINITIONS);
  const lambda = compileRegex("s|λ");
  const animal = compileRegex(PROPOSAL_ANIMAL);
  const mes = getTokenAutomata("MES");

  const fragments: Record<string, string> = {
    "tabla-er": tokenTable(),
    "afn-s-lambda": automatonSection("AFN-λ de (s|λ)", lambda.nfa),
    "afn-num": automatonSection("AFN-λ de NUM = DIGITO DIGITO*", num.nfa),
    "afd-num": automatonSection("AFD de NUM (subconjuntos)", num.dfa, num.dfa),
    "afd-num-min": automatonSection("AFD mínimo de NUM", minimize(num.dfa)),
    "afd-animal": [
      `AFN-λ de Thompson: ${animal.nfa.states.length} estados y ${animal.nfa.transitions.length} transiciones ` +
        "(tabla completa en `docs/automatas.md`).",
      automatonSection(`AFD de ${PROPOSAL_ANIMAL} (subconjuntos)`, animal.dfa, animal.dfa),
      automatonSection("AFD mínimo", minimize(animal.dfa)),
    ].join("\n\n"),
    "afd-mes":
      `MES: AFN-λ de ${mes.nfa.states.length} estados → AFD de ${mes.dfa.states.length} estados → ` +
      `AFD mínimo de ${minimize(mes.dfa).states.length} estados (completos en \`docs/automatas.md\`).`,
    "lex-fecha": lexTrace("desde el 15 de noviembre de 2026"),
    "pda-fecha": pdaTable("FECHA", "desde el 15 de noviembre de 2026"),
    "pda-fecha-lambda": pdaTable("FECHA", "desde el 15 de noviembre"),
    gramatica: fence("text", formatGrammar(grammar)),
    prediccion: predictionTable(),
    "lex-51": lexTrace("20 vacas holstein"),
    "ast-52": fence("text", treeText(parseFrom("LISTA", tokenize("20 vacas y 3 caballos").tokens).tree)),
    "pila-52": markerHistory("20 vacas de raza holstein de los cuales 5 terneras fin y 3 caballos"),
    "pda-52": pdaTable("LISTA", "20 vacas de raza holstein de los cuales 5 terneras fin y 3 caballos"),
    "pda-rechazo": [
      pdaTable("CONTRATO", "20 vacas fin"),
      `Con \`20 vacas de los cuales 5 terneras\` (sin \`fin\`): ` +
        `${parseContract(tokenize("20 vacas de los cuales 5 terneras").tokens).errors.join(" ")}`,
    ].join("\n\n"),
    "frases-55": sameFields(),
    "mt-seleccion": selectionSection(),
    "mt-relleno": fillSection(),
    "clausula-6": clauseSection(),
    "seleccion-demo": table(
      ["Contrato", "Campos extraídos"],
      DEMOS.map((d) => [d.file, code(extractedFieldNames(runPipeline(d.phrase).fields).join(", "))]),
    ),
  };

  const files: Record<string, string> = { "docs/automatas.md": automataFile() };
  for (const demo of DEMOS) files[`docs/contratos-demo/${demo.file}.md`] = demoContract(demo.phrase);
  return { files, fragments };
}

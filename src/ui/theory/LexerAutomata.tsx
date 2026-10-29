import { useState } from "react";
import { getTokenAutomata, TOKEN_DEFINITIONS } from "../../core/lexer";
import type { Automaton } from "../../core/regex";

/** Groups transitions by source state: "q0" → ["a→q1", "λ→q2"]. */
function rows(automaton: Automaton): { state: string; moves: string[] }[] {
  return automaton.states.map((state) => ({
    state,
    moves: automaton.transitions.filter((t) => t.from === state).map((t) => `${t.symbol} → ${t.to}`),
  }));
}

function TransitionTable({ automaton, caption, subsets }: { automaton: Automaton; caption: string; subsets?: Record<string, string[]> }) {
  return (
    <div className="max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
      <table className="data-table">
        <caption className="p-2 text-left font-semibold">
          {caption} · {automaton.states.length} estados · {automaton.transitions.length} transiciones
        </caption>
        <thead>
          <tr>
            <th scope="col">Estado</th>
            {subsets && <th scope="col">Subconjunto AFN</th>}
            <th scope="col">Transiciones</th>
          </tr>
        </thead>
        <tbody>
          {rows(automaton).map(({ state, moves }) => (
            <tr key={state}>
              <td className="font-mono whitespace-nowrap">
                {state === automaton.initial ? "→ " : ""}
                {automaton.accepting.includes(state) ? `*${state}` : state}
              </td>
              {subsets && <td className="font-mono text-xs">{`{${(subsets[state] ?? []).join(", ")}}`}</td>}
              <td className="font-mono text-xs">{moves.join(" · ") || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** NFA-λ (Thompson) and DFA (subsets) of one token definition, as transition tables. */
export function LexerAutomata({ initial }: { initial?: string }) {
  const names = TOKEN_DEFINITIONS.map((d) => d.name);
  const [name, setName] = useState(initial && names.includes(initial) ? initial : (names[0] ?? ""));
  const automata = getTokenAutomata(name);

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        Tipo de token
        <select value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-slate-300 bg-white p-1 dark:border-slate-600 dark:bg-slate-900">
          {names.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </label>
      <p className="text-sm">
        Expresión regular: <code className="break-all font-mono text-xs">{automata.regex}</code>
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">→ estado inicial · * estado de aceptación · λ transición vacía</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <TransitionTable automaton={automata.nfa} caption="AFN-λ (Thompson)" />
        <TransitionTable automaton={automata.dfa} caption="AFD (construcción de subconjuntos)" subsets={automata.dfa.subsets} />
      </div>
    </div>
  );
}

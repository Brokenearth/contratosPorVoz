import { useState } from "react";
import { getTokenAutomata, normalize, TOKEN_DEFINITIONS } from "../../core/lexer";
import { runDfa, type Automaton } from "../../core/regex";
import type { Token } from "../../core/types";
import { Playback, usePlayback } from "./Playback";
import { StateGraph } from "./StateGraph";

function TransitionTable({ automaton, caption }: { automaton: Automaton; caption: string }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption>
          {caption} · {automaton.states.length} estados · {automaton.transitions.length} transiciones
        </caption>
        <thead>
          <tr>
            <th>Origen</th>
            <th>Símbolo</th>
            <th>Destino</th>
          </tr>
        </thead>
        <tbody>
          {automaton.transitions.map((t, i) => (
            <tr key={i}>
              <td>{t.from}</td>
              <td>{t.symbol}</td>
              <td>{t.to}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Simulation({ name, input }: { name: string; input: string }) {
  const { dfa, nfa, regex } = getTokenAutomata(name);
  const normalized = normalize(input);
  const run = runDfa(dfa, normalized);
  const consumed = run.states.length - 1;
  const rejected = consumed < normalized.length;
  const playback = usePlayback(run.states.length + (rejected ? 1 : 0));
  const current = run.states[Math.min(playback.index, run.states.length - 1)];
  const [full, setFull] = useState(false);
  const transitions = run.states.slice(1).map((to, i) => ({ from: run.states[i]!, to, symbol: normalized[i]! }));
  const path: Automaton = {
    ...dfa,
    states: [...new Set(run.states)],
    transitions,
    accepting: dfa.accepting.filter((s) => run.states.includes(s)),
  };
  const finished = playback.index === playback.last;
  return (
    <div className="simulation">
      <div className="simulation-heading">
        <div>
          <p className="eyebrow">AUTÓMATA FINITO DETERMINISTA</p>
          <h3>Una letra, una transición</h3>
        </div>
        <span className={`status-tag ${finished && !run.accepted ? "is-warning" : ""}`}>
          {finished ? (run.accepted ? "Cadena aceptada" : "Cadena rechazada") : "Leyendo la cadena"}
        </span>
      </div>
      <p className="theory-description">
        El AFD reconoce un token leyendo sus caracteres en minúsculas y sin tildes. La flecha marca el inicio y el doble
        círculo, los estados de aceptación.
      </p>
      <div className="symbol-strip" aria-label="Caracteres de la cadena">
        {[...normalized].map((ch, i) => (
          <span key={i} className={i === playback.index ? "is-current" : i < playback.index ? "is-read" : ""}>
            {ch === " " ? "␣" : ch}
          </span>
        ))}
        {!normalized && <span>λ</span>}
      </div>
      <div className="graph-toolbar">
        <strong>
          Estado: <code>{current}</code>
        </strong>
        <label>
          <input type="checkbox" checked={full} onChange={(e) => setFull(e.target.checked)} /> Mostrar AFD completo (
          {dfa.states.length} estados)
        </label>
      </div>
      <StateGraph
        automaton={full ? dfa : path}
        active={current}
        edge={
          playback.index > 0 && playback.index < run.states.length
            ? [run.states[playback.index - 1]!, current!]
            : undefined
        }
        label={full ? "Grafo completo del AFD" : "Recorrido de la cadena sobre el AFD"}
      />
      <p className="simulation-note" role="status">
        {rejected && playback.index > consumed
          ? `No existe una transición para «${normalized[consumed]}» desde ${current}. La cadena se rechaza.`
          : normalized.length === 0
            ? "La cadena vacía (λ) no llega a un estado de aceptación de este token."
            : playback.index === 0
              ? `El recorrido comienza en ${dfa.initial}. Pulse Paso para leer el primer carácter.`
              : `Se leyó «${normalized[playback.index - 1]}»: ${run.states[playback.index - 1]} → ${current}.${finished ? (run.accepted ? " La entrada terminó en un estado de aceptación." : " La entrada no terminó en un estado de aceptación.") : ""}`}
      </p>
      <Playback playback={playback} label="Carácter del AFD" />
      <details className="technical-details">
        <summary>Expresión regular y tablas de construcción</summary>
        <p>
          Expresión regular: <code className="regex-expression">{regex}</code>
        </p>
        <div className="technical-grid">
          <TransitionTable automaton={nfa} caption="AFN-λ (Thompson)" />
          <TransitionTable automaton={dfa} caption="AFD (construcción de subconjuntos)" />
        </div>
      </details>
    </div>
  );
}

export function LexerAutomata({ initial = "NUM", tokens = [] }: { initial?: string; tokens?: Token[] }) {
  const [name, setName] = useState(initial);
  const [input, setInput] = useState(tokens.find((t) => t.type === "NUM" && /^\d+$/.test(t.lexeme))?.lexeme ?? "20");
  const examples = tokens.filter(
    (t) => t.synonymOf === undefined && runDfa(getTokenAutomata(name).dfa, normalize(t.lexeme)).accepted,
  );
  return (
    <div>
      <div className="simulation-inputs">
        <label>
          Tipo de token
          <select
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              const dfa = getTokenAutomata(e.target.value).dfa;
              setInput(tokens.find((t) => runDfa(dfa, normalize(t.lexeme)).accepted)?.lexeme ?? "");
            }}
          >
            {TOKEN_DEFINITIONS.map((d) => (
              <option key={d.name}>{d.name}</option>
            ))}
          </select>
        </label>
        <label>
          Cadena de prueba
          <input
            value={input}
            maxLength={60}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escriba una palabra o número"
          />
        </label>
      </div>
      {examples.length > 0 && (
        <div className="token-examples">
          <span>En su texto:</span>
          {[...new Set(examples.map((t) => t.lexeme))].slice(0, 8).map((t) => (
            <button type="button" className="chip" key={t} onClick={() => setInput(t)}>
              {t}
            </button>
          ))}
        </div>
      )}
      <Simulation key={`${name}:${input}`} name={name} input={input} />
    </div>
  );
}

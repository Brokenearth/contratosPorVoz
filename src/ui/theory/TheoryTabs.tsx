import { useRef, useState, type ReactNode } from "react";
import { questionFor } from "../../core/dialog";
import type { PipelineResult } from "../../core/pipeline";
import type { ParseTree } from "../../core/types";
import { contractValues } from "../../core/templates";
import { fillMachine } from "../../core/turing/fill";
import { selectionMachine } from "../../core/turing/selection";
import { Panel } from "../Panel";
import { LexerAutomata } from "./LexerAutomata";
import { StackViewer } from "./StackViewer";
import { TuringViewer } from "./TuringViewer";

const TABS = [
  "Tokens",
  "Autómata del léxico",
  "Árbol de derivación",
  "Pila",
  "Selección",
  "Máquina de Turing",
] as const;
type Tab = (typeof TABS)[number];
const DESCRIPTIONS = [
  "Separar las palabras",
  "Reconocer un token",
  "Aplicar la gramática",
  "Seguir el análisis",
  "Elegir la plantilla",
  "Construir el documento",
];

function TokensTab({ result }: { result: PipelineResult }) {
  const { tokens, trace } = result.lex;
  return (
    <div>
      <div className="simulation-heading">
        <div>
          <p className="eyebrow">ANÁLISIS LÉXICO</p>
          <h3>Del texto a los tokens</h3>
        </div>
        <span className="status-tag">{tokens.length} tokens</span>
      </div>
      <p className="theory-description">
        El analizador agrupa caracteres y asigna un tipo a cada palabra o número. Después, el diccionario transforma los
        sinónimos en expresiones que reconoce la gramática.
      </p>
      <div className="token-ribbon" aria-label="Secuencia de tokens">
        {tokens.map((t, i) => (
          <span key={i} title={`${t.type}: ${String(t.value)}`}>
            <strong>{t.lexeme}</strong>
            <small>{t.type}</small>
          </span>
        ))}
      </div>
      <details className="technical-details">
        <summary>Ver valores y recorridos de los tokens</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Tipo</th>
                <th>Lexema</th>
                <th>Valor</th>
                <th>Estados del AFD</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token, i) => {
                const step =
                  token.synonymOf === undefined
                    ? trace.find((s) => s.position === token.start && s.accepted)
                    : undefined;
                return (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>
                      <code>{token.type}</code>
                    </td>
                    <td>
                      {token.lexeme}
                      {token.synonymOf !== undefined && <small> (sinónimo de «{token.synonymOf}»)</small>}
                    </td>
                    <td>{String(token.value)}</td>
                    <td>
                      <code>{step?.dfaStates.join(" → ") ?? "—"}</code>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function TreeNode({ node }: { node: ParseTree }) {
  return (
    <li>
      <span className={node.token ? "tree-terminal" : "tree-nonterminal"}>
        {node.symbol}
        {node.token && <em> «{node.token.lexeme}»</em>}
        {!node.token && node.children.length === 0 && " λ"}
      </span>
      {node.children.length > 0 && (
        <ul>
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}
function TreeTab({ result }: { result: PipelineResult }) {
  if (!result.parse.tree)
    return <p className="pending-note">No se pudo construir el árbol. Revise los avisos del análisis.</p>;
  return (
    <div>
      <div className="simulation-heading">
        <div>
          <p className="eyebrow">GRAMÁTICA LIBRE DE CONTEXTO</p>
          <h3>La estructura de lo que dijo</h3>
        </div>
        <span className="status-tag">{result.parse.ok ? "Cadena aceptada" : "Análisis parcial"}</span>
      </div>
      <p className="theory-description">
        Cada rama aplica una producción. Los símbolos de la gramática se descomponen hasta llegar a las palabras de su
        texto.
      </p>
      <div className="tree-scroll">
        <ul className="derivation-tree" aria-label="Árbol de derivación">
          <TreeNode node={result.parse.tree} />
        </ul>
      </div>
    </div>
  );
}
function SelectionTab({ result }: { result: PipelineResult }) {
  const { scores, templateId, tie, low, run } = result.selection;
  return (
    <div>
      <div className="selection-scores">
        {Object.entries(scores).map(([id, { matched, total }]) => (
          <div className={id === templateId ? "score-card is-selected" : "score-card"} key={id}>
            <div>
              <h3>{id.toLowerCase()}</h3>
              <span>{id === templateId ? "Seleccionada" : "Alternativa"}</span>
            </div>
            <strong>
              {total ? Math.round((matched / total) * 100) : 0}
              <small>%</small>
            </strong>
            <progress value={matched} max={total} aria-label={`Coincidencias ${id}`} />
            <p>
              {matched} de {total} campos requeridos detectados
            </p>
          </div>
        ))}
      </div>
      <p className="theory-description">
        La máquina compara los campos, cuenta coincidencias y escribe el resultado en cinta. Los animales y el cultivo
        permiten distinguir el uso del lote. Sin esa evidencia, el resultado queda sin plantilla.
      </p>
      {(tie || low) && (
        <p className="pending-note">
          {tie
            ? "Empate entre plantillas. Complete los datos para precisar la elección."
            : "Coincidencia baja: aún faltan datos para identificar el contrato."}
        </p>
      )}
      <TuringViewer run={run} label="Máquina de Turing de selección" machine={selectionMachine(true)} />
    </div>
  );
}
function TuringTab({ result }: { result: PipelineResult }) {
  if (!result.fill)
    return (
      <div className="theory-empty">
        <h3>La plantilla está lista para completar</h3>
        <p>
          La máquina de llenado se ejecuta cuando el contrato se genera. Complete los datos solicitados o genere el
          documento con campos pendientes.
        </p>
      </div>
    );
  return (
    <TuringViewer
      run={result.fill}
      label="Máquina de Turing de llenado"
      machine={fillMachine(contractValues(result.fields, questionFor(result.missing).replace(/^Falta /, "")))}
    />
  );
}

export function TheoryTabs({
  result,
  runId,
  input,
  isAnswer,
}: {
  result: PipelineResult;
  runId: number;
  input: string;
  isAnswer: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Tokens");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const content: Record<Tab, ReactNode> = {
    Tokens: <TokensTab result={result} />,
    "Autómata del léxico": <LexerAutomata tokens={result.lex.tokens} />,
    "Árbol de derivación": <TreeTab result={result} />,
    Pila: <StackViewer result={result} />,
    Selección: <SelectionTab result={result} />,
    "Máquina de Turing": <TuringTab result={result} />,
  };
  return (
    <Panel id="teoria" title="Cómo funciona por dentro" actions={<span className="section-number">LABORATORIO</span>}>
      <div className="theory-intro">
        <p>Explore el camino de sus palabras hasta el contrato.</p>
        <div className="pipeline-map" aria-label="Etapas del procesamiento">
          <span>Texto de entrada</span>
          <span>AFD · Tokens</span>
          <span>Pila · Gramática</span>
          <span>MT · Plantilla y llenado</span>
          <span>Contrato</span>
        </div>
        <details className="analyzed-input">
          <summary>
            {isAnswer ? "Última respuesta analizada" : "Texto analizado"} · ejecución {runId}
          </summary>
          <p>{input}</p>
          {isAnswer && (
            <p>
              Los tokens, el árbol y la pila corresponden a esta respuesta. La selección y el contrato usan los datos
              acumulados de la conversación.
            </p>
          )}
        </details>
      </div>
      <div role="tablist" aria-label="Paneles de teoría" className="theory-tabs">
        {TABS.map((t, i) => (
          <button
            key={t}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            aria-label={t}
            type="button"
            id={`theory-tab-${i}`}
            aria-selected={tab === t}
            tabIndex={tab === t ? 0 : -1}
            aria-controls="panel-teoria"
            onClick={() => setTab(t)}
            onKeyDown={(e) => {
              const next =
                e.key === "ArrowRight"
                  ? (i + 1) % TABS.length
                  : e.key === "ArrowLeft"
                    ? (i - 1 + TABS.length) % TABS.length
                    : e.key === "Home"
                      ? 0
                      : e.key === "End"
                        ? TABS.length - 1
                        : null;
              if (next !== null) {
                e.preventDefault();
                setTab(TABS[next]!);
                refs.current[next]?.focus();
              }
            }}
          >
            <span className="tab-title">
              <b>0{i + 1}</b>
              {t}
            </span>
            <small>{DESCRIPTIONS[i]}</small>
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id="panel-teoria"
        aria-labelledby={`theory-tab-${TABS.indexOf(tab)}`}
        tabIndex={0}
        className="theory-content"
      >
        {content[tab]}
      </div>
    </Panel>
  );
}

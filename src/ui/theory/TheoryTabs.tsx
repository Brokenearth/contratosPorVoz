import { useState, type ReactNode } from "react";
import type { PipelineResult } from "../../core/pipeline";
import type { ParseTree } from "../../core/types";
import { Panel } from "../Panel";
import { LexerAutomata } from "./LexerAutomata";
import { TuringViewer } from "./TuringViewer";

const TABS = ["Tokens", "Autómata del léxico", "Árbol de derivación", "Pila", "Selección", "Máquina de Turing"] as const;
type Tab = (typeof TABS)[number];

function Scroll({ children }: { children: ReactNode }) {
  return <div className="max-h-[28rem] overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">{children}</div>;
}

function TokensTab({ result }: { result: PipelineResult }) {
  const { tokens, trace } = result.lex;
  return (
    <Scroll>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Tipo</th>
            <th scope="col">Lexema</th>
            <th scope="col">Valor</th>
            <th scope="col">Estados del AFD</th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((token, i) => {
            const step = trace.find((s) => s.position === token.start && s.accepted);
            return (
              <tr key={i}>
                <td>{i + 1}</td>
                <td className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{token.type}</td>
                <td>{token.lexeme}</td>
                <td>{String(token.value)}</td>
                <td className="font-mono text-xs">{step ? step.dfaStates.join(" → ") : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Scroll>
  );
}

function TreeNode({ node }: { node: ParseTree }) {
  return (
    <li>
      <span className={node.token ? "font-mono text-emerald-700 dark:text-emerald-400" : "font-semibold"}>
        {node.symbol}
        {node.token && <span className="text-slate-600 dark:text-slate-300"> “{node.token.lexeme}”</span>}
        {!node.token && node.children.length === 0 && <span className="text-slate-400"> λ</span>}
      </span>
      {node.children.length > 0 && (
        <ul className="ml-3 border-l border-slate-300 pl-3 dark:border-slate-700">
          {node.children.map((child, i) => (
            <TreeNode key={i} node={child} />
          ))}
        </ul>
      )}
    </li>
  );
}

function TreeTab({ result }: { result: PipelineResult }) {
  const { tree, ok } = result.parse;
  if (!tree) return <p className="text-sm">No se pudo construir el árbol.</p>;
  return (
    <div className="space-y-2">
      <p className="text-sm">{ok ? "Cadena aceptada por la gramática." : "La cadena no fue aceptada por completo."}</p>
      <Scroll>
        <ul className="p-3 text-sm" aria-label="Árbol de derivación">
          <TreeNode node={tree} />
        </ul>
      </Scroll>
    </div>
  );
}

function StackTab({ result }: { result: PipelineResult }) {
  return (
    <Scroll>
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Paso</th>
            <th scope="col">Entrada restante</th>
            <th scope="col">Acción</th>
            <th scope="col">Pila Z0/SUB</th>
            <th scope="col">Pila de símbolos (tope a la derecha)</th>
          </tr>
        </thead>
        <tbody>
          {result.parse.trace.map((step, i) => (
            <tr key={i}>
              <td>{i}</td>
              <td className="max-w-56 truncate" title={step.input}>
                {step.input || "λ"}
              </td>
              <td className="font-mono text-xs">{step.action}</td>
              <td className="font-mono">{step.stack.join(" ")}</td>
              <td className="font-mono text-xs">{step.symbols.join(" ") || "∅"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Scroll>
  );
}

function SelectionTab({ result }: { result: PipelineResult }) {
  const { scores, templateId, tie, low, run } = result.selection;
  return (
    <div className="space-y-4">
      <table className="data-table max-w-md">
        <thead>
          <tr>
            <th scope="col">Plantilla</th>
            <th scope="col">Coincidencias</th>
            <th scope="col">Puntaje</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(scores).map(([id, { matched, total }]) => (
            <tr key={id} className={id === templateId ? "bg-emerald-50 font-semibold dark:bg-emerald-500/10" : ""}>
              <td>
                {id} {id === templateId && "✔"}
              </td>
              <td>
                {matched} / {total}
              </td>
              <td>{total > 0 ? Math.round((matched / total) * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(tie || low) && <p className="text-sm text-amber-700 dark:text-amber-300">{tie ? "Empate entre plantillas." : "Coincidencia baja."}</p>}
      <TuringViewer run={run} label="Máquina de Turing de selección" />
    </div>
  );
}

function TuringTab({ result }: { result: PipelineResult }) {
  if (!result.contract) return <p className="text-sm">La máquina de llenado se ejecuta cuando el contrato se genera.</p>;
  return <TuringViewer run={result.contract} label="Máquina de Turing de llenado" />;
}

export function TheoryTabs({ result, runId }: { result: PipelineResult; runId: number }) {
  const [tab, setTab] = useState<Tab>("Tokens");
  const content: Record<Tab, ReactNode> = {
    Tokens: <TokensTab result={result} />,
    "Autómata del léxico": <LexerAutomata initial="NUM" />,
    "Árbol de derivación": <TreeTab result={result} />,
    Pila: <StackTab result={result} />,
    Selección: <SelectionTab key={runId} result={result} />,
    "Máquina de Turing": <TuringTab key={runId} result={result} />,
  };
  return (
    <Panel id="teoria" title="Cómo funciona por dentro">
      <div role="tablist" aria-label="Paneles de teoría" className="mb-4 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            id={`tab-${t}`}
            aria-selected={tab === t}
            aria-controls="panel-teoria"
            onClick={() => setTab(t)}
            className={`-mb-px rounded-t-lg border-b-2 px-3 py-2 text-sm ${
              tab === t
                ? "border-emerald-600 font-semibold text-emerald-700 dark:text-emerald-400"
                : "border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="panel-teoria" aria-labelledby={`tab-${tab}`}>
        {content[tab]}
      </div>
    </Panel>
  );
}

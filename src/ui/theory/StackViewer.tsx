import type { PipelineResult } from "../../core/pipeline";
import { Playback, usePlayback } from "./Playback";

export function StackViewer({ result }: { result: PipelineResult }) {
  const { trace, ok } = result.parse;
  const playback = usePlayback(trace.length);
  const step = trace[playback.index];
  if (!step) return <p>No hay pasos de la pila para esta entrada.</p>;
  const previous = trace[Math.max(0, playback.index - 1)]!;
  const difference = step.symbols.length - previous.symbols.length;
  const terminal = playback.index === playback.last;
  return (
    <div className="simulation">
      <div className="simulation-heading">
        <div>
          <p className="eyebrow">AUTÓMATA A PILA</p>
          <h3>La gramática toma forma</h3>
        </div>
        <span className={`status-tag ${terminal && !ok ? "is-warning" : ""}`}>
          {terminal ? (ok ? "Entrada aceptada" : "Entrada rechazada") : "Análisis en curso"}
        </span>
      </div>
      <p className="theory-description">
        La pila de símbolos guarda lo que falta por reconocer. Las producciones apilan símbolos y la lectura los retira.
        La pila de anidamiento añade SUB al leer «de los cuales» y lo retira con «fin».
      </p>
      <div className="stack-workspace">
        <div className="stack-input">
          <p className="eyebrow">ENTRADA RESTANTE</p>
          <p className="remaining-input">{step.input || "λ · No queda entrada"}</p>
          <p className="eyebrow">ACCIÓN ACTUAL</p>
          <code className="stack-action" data-testid="pda-action">
            {step.action}
          </code>
          <p className="simulation-note">
            {playback.index === 0
              ? "La pila inicia con el símbolo CONTRATO."
              : difference > 0
                ? `La pila creció en ${difference} símbolos.`
                : difference < 0
                  ? `La pila se redujo en ${Math.abs(difference)} símbolos.`
                  : "La acción conserva el tamaño de la pila de símbolos."}
          </p>
        </div>
        <div className="stack-column">
          <h4>Pila de símbolos</h4>
          <span className="stack-direction">Tope ↓</span>
          <div className="stack-cells" role="list" aria-label="Pila de símbolos">
            {step.symbols.length ? (
              [...step.symbols].reverse().map((s, i) => (
                <div role="listitem" key={i} className={i === 0 ? "is-top" : ""}>
                  {s}
                </div>
              ))
            ) : (
              <p className="empty-stack">Pila vacía</p>
            )}
          </div>
          <span className="stack-base">Base de la pila</span>
        </div>
        <div className="stack-column nesting-column">
          <h4>Anidamiento</h4>
          <span className="stack-direction">Tope ↓</span>
          <div className="stack-cells" role="list" aria-label="Pila de anidamiento">
            {[...step.stack].reverse().map((s, i) => (
              <div role="listitem" key={i} className={s === "SUB" ? "is-top" : ""}>
                {s}
              </div>
            ))}
          </div>
          <span className="stack-base">Z0: fondo permanente</span>
          <p className="simulation-note">{step.stack.length - 1} niveles abiertos</p>
        </div>
      </div>
      <Playback playback={playback} label="Paso de la pila" />
      <details className="technical-details">
        <summary>Ver la traza completa de la pila</summary>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>Paso</th>
                <th>Acción</th>
                <th>Anidamiento</th>
                <th>Símbolos (tope a la derecha)</th>
              </tr>
            </thead>
            <tbody>
              {trace.map((s, i) => (
                <tr key={i} aria-current={i === playback.index ? "step" : undefined}>
                  <td>{i}</td>
                  <td>{s.action}</td>
                  <td>{s.stack.join(" · ")}</td>
                  <td>{s.symbols.join(" · ") || "∅"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

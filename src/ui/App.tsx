import { useState } from "react";
import { runPipeline, type PipelineResult } from "../core/pipeline";
import type { ContractFields } from "../core/types";
import { ContractPanel } from "./ContractPanel";
import { Conversation } from "./Conversation";
import { Icon } from "./Icon";
import { InputPanel } from "./InputPanel";
import { TheoryTabs } from "./theory/TheoryTabs";
import type { InputSource } from "./voice";

interface Analysis {
  input: string;
  previous: ContractFields;
  result: PipelineResult;
  id: number;
}

export function App({ source }: { source?: InputSource }) {
  const [text, setText] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  function analyze(input: string, previous: ContractFields, force = false) {
    setAnalysis((current) => ({
      input,
      previous,
      result: runPipeline(input, previous, { force }),
      id: (current?.id ?? 0) + 1,
    }));
  }

  const result = analysis?.result;
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#redactar">
            <span className="brand-symbol">
              <Icon name="document" />
            </span>
            <span>
              Contratos rurales <span className="brand-light">por voz</span>
            </span>
          </a>
          <nav aria-label="Navegación principal">
            <a href="#redactar">Redactar</a>
            {analysis && <a href="#teoria">Cómo funciona</a>}
          </nav>
          <span className="course-label">Lenguajes y autómatas</span>
        </div>
      </header>
      <main className="workspace">
        <div className="workspace-intro" id="redactar">
          <div>
            <p className="eyebrow">ARRENDAMIENTO RURAL</p>
            <h1>Contratos rurales por voz</h1>
            <p>Cuente lo que necesita acordar. Dé forma a su contrato, paso a paso.</p>
          </div>
          <ol className="workflow" aria-label="Etapas del contrato">
            {["Redacción", "Revisión", "Documento"].map((label, i) => (
              <li
                key={label}
                aria-current={(result?.contract ? i === 2 : result ? i === 1 : i === 0) ? "step" : undefined}
              >
                <span>0{i + 1}</span>
                {label}
              </li>
            ))}
          </ol>
        </div>
        <div className="editor-layout">
          <div className="editor-column">
            <InputPanel text={text} onTextChange={setText} onAnalyze={() => analyze(text, {})} source={source} />
            {analysis && result && (
              <Conversation
                key={analysis.id}
                result={result}
                source={source}
                onAnswer={(answer) => analyze(answer, result.fields)}
                onForce={() => analyze(analysis.input, analysis.previous, true)}
              />
            )}
          </div>
          <div className="document-column">
            {result?.contract && result.template ? (
              <ContractPanel markdown={result.contract.output} template={result.template} />
            ) : (
              <section className="document-empty" aria-label="Vista previa del contrato">
                <div className="document-empty-heading">
                  <span className="eyebrow">SU DOCUMENTO</span>
                  <span className="status-tag">{result ? "Datos por completar" : "Aún sin generar"}</span>
                </div>
                <div className="paper-preview">
                  <span className="paper-category">CONTRATO DE ARRENDAMIENTO RURAL</span>
                  <h2>
                    Un acuerdo claro,
                    <br />
                    desde el principio.
                  </h2>
                  <p>El documento se organizará con los datos de su redacción.</p>
                  <ol className="document-outline">
                    {[
                      "Las partes del acuerdo",
                      "El lote y su destinación",
                      "Duración y valor",
                      "Obligaciones y condiciones",
                      "Firmas",
                    ].map((t, i) => (
                      <li key={t}>
                        <span>0{i + 1}</span>
                        {t}
                        <span className="outline-line" />
                      </li>
                    ))}
                  </ol>
                  <div className="paper-signatures" aria-hidden="true">
                    <span>ARRENDADOR</span>
                    <span>ARRENDATARIO</span>
                  </div>
                </div>
                <p className="document-empty-note">
                  {result
                    ? "Complete los datos solicitados para generar el contrato."
                    : "Empiece con su redacción o cargue un ejemplo para explorar el proceso."}
                </p>
              </section>
            )}
          </div>
        </div>
        {analysis && result && (
          <TheoryTabs
            key={analysis.id}
            result={result}
            runId={analysis.id}
            input={analysis.input}
            isAnswer={Object.keys(analysis.previous).length > 0}
          />
        )}
        <footer className="site-footer">
          <span>Contratos rurales por voz</span>
          <span>Del lenguaje natural a los modelos de cómputo.</span>
        </footer>
      </main>
    </div>
  );
}

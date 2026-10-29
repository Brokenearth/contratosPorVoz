import { useState } from "react";
import { runPipeline, type PipelineResult } from "../core/pipeline";
import type { ContractFields } from "../core/types";
import { ContractPanel } from "./ContractPanel";
import { Conversation } from "./Conversation";
import { InputPanel } from "./InputPanel";
import { TheoryTabs } from "./theory/TheoryTabs";
import type { InputSource } from "./voice";

interface Analysis {
  /** Text of the last analyzed utterance (initial dictation or an answer). */
  input: string;
  /** Fields known before that utterance. */
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
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-4">
          <div>
            <h1 className="text-2xl font-bold">Contratos rurales por voz</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Arrendamiento de lotes para pastoreo y cultivo, del dictado al contrato.
            </p>
          </div>
          <p role="note" className="rounded-lg bg-amber-100 px-3 py-2 text-sm font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
            ⚖️ Borrador informativo; no reemplaza la asesoría de un abogado
          </p>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-2">
        <div className="min-w-0 space-y-6">
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
        <div className="min-w-0 space-y-6">
          {result?.contract && result.template ? (
            <ContractPanel markdown={result.contract.output} template={result.template} />
          ) : (
            <section className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              El contrato aparecerá aquí cuando estén todos los campos requeridos (o pulse «Generar de todos modos»).
            </section>
          )}
        </div>
        {analysis && result && (
          <div className="min-w-0 lg:col-span-2">
            <TheoryTabs result={result} runId={analysis.id} />
          </div>
        )}
      </main>
    </div>
  );
}

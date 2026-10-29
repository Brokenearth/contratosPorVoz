import { guideText } from "../core/dialog";
import { DEMO_PHRASES } from "../core/pipeline";
import { TEMPLATES } from "../core/templates";
import { DictationField } from "./DictationField";
import { Panel } from "./Panel";
import { isSpeechSupported, isSynthesisSupported, speak, type InputSource } from "./voice";

const unique = (keys: string[]) => [...new Set(keys)];

/** §5.6 guide built from the fields declared by every template (not hardcoded). */
export const GUIDE = (() => {
  const required = unique(TEMPLATES.flatMap((t) => t.required));
  const optional = unique(TEMPLATES.flatMap((t) => t.optional)).filter((k) => !required.includes(k) && k !== "animales_descripcion");
  return guideText({ required, optional });
})();

const DEMO_LABELS = ["Pastoreo (leche)", "Pastoreo (ceba)", "Pastoreo anidado", "Cultivo (maíz)", "Cultivo (café)", "Mixta"];

interface Props {
  text: string;
  onTextChange: (text: string) => void;
  onAnalyze: () => void;
  source?: InputSource;
}

export function InputPanel({ text, onTextChange, onAnalyze, source }: Props) {
  const voice = source?.supported ?? isSpeechSupported();
  return (
    <Panel
      id="entrada"
      title="1. Dicte o escriba su contrato"
      actions={
        isSynthesisSupported() ? (
          <button type="button" className="btn-secondary" onClick={() => speak(GUIDE)}>
            🔊 Leer guía
          </button>
        ) : null
      }
    >
      <div aria-label="Guía" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm whitespace-pre-line text-emerald-950 dark:border-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-100">
        {GUIDE}
      </div>
      <DictationField
        id="dictado"
        label="Texto del contrato"
        value={text}
        onChange={onTextChange}
        rows={5}
        placeholder="Ej.: arriendo el lote 20 de 8 hectáreas para 20 toros gir por 30 días…"
        source={source}
      />
      {!voice && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Su navegador no admite reconocimiento de voz; puede escribir el texto (Chrome o Edge permiten dictar).
        </p>
      )}
      <div className="mt-4">
        <p className="mb-2 text-xs font-medium text-slate-500 uppercase dark:text-slate-400">Frases de ejemplo</p>
        <div className="flex flex-wrap gap-2">
          {DEMO_PHRASES.map((phrase, i) => (
            <button key={i} type="button" title={phrase} className="chip" onClick={() => onTextChange(phrase)}>
              {DEMO_LABELS[i] ?? `Ejemplo ${i + 1}`}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className="btn-primary mt-4 w-full sm:w-auto" onClick={onAnalyze} disabled={!text.trim()}>
        Analizar
      </button>
    </Panel>
  );
}

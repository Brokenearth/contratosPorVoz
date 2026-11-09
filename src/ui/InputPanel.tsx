import { useState } from "react";
import { guideText } from "../core/dialog";
import { DEMO_PHRASES } from "../core/pipeline";
import { TEMPLATES } from "../core/templates";
import { DictationField } from "./DictationField";
import { Icon } from "./Icon";
import { Panel } from "./Panel";
import { isSpeechSupported, type InputSource } from "./voice";

const unique = (keys: string[]) => [...new Set(keys)];
export const GUIDE = (() => {
  const required = unique(TEMPLATES.flatMap((t) => t.required));
  const optional = unique(TEMPLATES.flatMap((t) => t.optional)).filter(
    (k) => !required.includes(k) && k !== "animales_descripcion",
  );
  return guideText({ required, optional });
})();
const DEMO_LABELS = [
  "Pastoreo (leche)",
  "Pastoreo (ceba)",
  "Pastoreo anidado",
  "Cultivo (maíz)",
  "Cultivo (café)",
  "Mixta",
];

interface Props {
  text: string;
  onTextChange: (text: string) => void;
  onAnalyze: () => void;
  source?: InputSource;
}

export function InputPanel({ text, onTextChange, onAnalyze, source }: Props) {
  const [listening, setListening] = useState(false);
  const voice = source?.supported ?? isSpeechSupported();
  return (
    <Panel id="entrada" title="Redacción del contrato" actions={<span className="section-number">01</span>}>
      <div className="instructions" aria-label="Instrucciones">
        <h3>Instrucciones para redactar</h3>
        <p>Use este orden como referencia. También puede dictar los datos en otro orden.</p>
        <ol className="instruction-steps">
          <li>
            <span>1</span>
            <div>
              <strong>El lote y su uso</strong>
              <p>Nombre o número, área, animales y raza, cultivo e insumos según corresponda.</p>
            </div>
          </li>
          <li>
            <span>2</span>
            <div>
              <strong>Las condiciones</strong>
              <p>Fecha de inicio, duración y valor del arrendamiento.</p>
            </div>
          </li>
          <li>
            <span>3</span>
            <div>
              <strong>Las partes</strong>
              <p>Nombres del arrendador y del arrendatario, si los conoce.</p>
            </div>
          </li>
        </ol>
        <details className="guide-details">
          <summary>Ver todos los datos admitidos</summary>
          <p aria-label="Guía">{GUIDE}</p>
        </details>
      </div>
      <DictationField
        id="dictado"
        label="Texto del contrato"
        value={text}
        onChange={onTextChange}
        rows={7}
        placeholder="Arriendo el lote La Esperanza de 5 hectáreas para 20 vacas de raza Holstein, por 12 meses desde el 15 de noviembre de 2026, por un valor de 6 millones de pesos…"
        source={source}
        onListeningChange={setListening}
      />
      <p className="input-help">
        {voice
          ? "El micrófono espera 7 segundos de silencio antes de terminar. Revise el texto antes de analizar."
          : "Puede escribir el contrato. Para dictar por voz, abra la aplicación en Chrome o Edge."}
      </p>
      <div className="examples">
        <p className="eyebrow">PRUEBE CON UN EJEMPLO</p>
        <div className="example-options">
          {DEMO_PHRASES.map((phrase, i) => (
            <button
              key={i}
              type="button"
              title={phrase}
              className="chip"
              disabled={listening}
              onClick={() => onTextChange(phrase)}
            >
              {DEMO_LABELS[i]}
            </button>
          ))}
        </div>
      </div>
      <div className="input-actions">
        <span>Se le pedirán los datos que falten.</span>
        <button type="button" className="btn-primary" onClick={onAnalyze} disabled={!text.trim() || listening}>
          Analizar <Icon name="arrow" />
        </button>
      </div>
    </Panel>
  );
}

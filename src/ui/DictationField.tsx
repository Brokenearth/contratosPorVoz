import { useEffect, useRef, useState } from "react";
import { speechInput, type InputSource } from "./voice";
import { Icon } from "./Icon";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  source?: InputSource;
  onListeningChange?: (listening: boolean) => void;
}

function join(base: string, extra: string): string {
  return [base.trim(), extra.trim()].filter(Boolean).join(" ");
}

/** Editable textarea with a microphone button: recognized text lands in the box and can be corrected (§9). */
export function DictationField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  source = speechInput,
  onListeningChange,
}: Props) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  const baseRef = useRef("");

  useEffect(() => () => stopRef.current?.(), []);

  function toggle() {
    if (listening) {
      stopRef.current?.();
      return;
    }
    setError("");
    baseRef.current = value;
    setListening(true);
    onListeningChange?.(true);
    stopRef.current = source.start({
      onInterim: (text) => onChange(join(baseRef.current, text)),
      onFinal: (text) => {
        baseRef.current = join(baseRef.current, text);
        onChange(baseRef.current);
      },
      onError: setError,
      onEnd: () => {
        setListening(false);
        onListeningChange?.(false);
        stopRef.current = null;
      },
    });
  }

  return (
    <div className="dictation-field">
      <div className="field-heading">
        <label htmlFor={id}>{label}</label>
        <span>Editable</span>
      </div>
      <div className={`dictation-box ${listening ? "is-listening" : ""}`}>
        <textarea
          id={id}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={`${id}-ayuda`}
          readOnly={listening}
        />
        <div className="dictation-toolbar">
          <span id={`${id}-ayuda`}>{listening ? "Micrófono activo" : "Escriba o use el micrófono"}</span>
          {source.supported && (
            <button
              type="button"
              onClick={toggle}
              aria-pressed={listening}
              aria-label={listening ? "Detener dictado" : "Dictar por voz"}
              title={listening ? "Detener dictado" : "Dictar por voz"}
              className={`mic-button ${listening ? "is-active" : ""}`}
            >
              <Icon name={listening ? "stop" : "mic"} />
              {listening ? "Detener" : "Dictar por voz"}
            </button>
          )}
        </div>
      </div>
      {listening && (
        <p role="status" className="voice-status">
          Escuchando. Puede hacer pausas: el dictado termina tras 7 segundos de silencio. Deténgalo para editar el
          texto.
        </p>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}

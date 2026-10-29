/** Callbacks of a voice dictation session. */
export interface ListenHandlers {
  /** Partial text while the user is still speaking. */
  onInterim: (text: string) => void;
  /** Final text of a recognized phrase. */
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

/** Any source of dictated text (Web Speech API, a fake in tests, …). */
export interface InputSource {
  supported: boolean;
  /** Starts listening; returns a function that stops it. */
  start: (handlers: ListenHandlers) => () => void;
}

interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: RecognitionAlternative | undefined;
}
interface RecognitionEvent {
  resultIndex: number;
  results: { readonly length: number; [index: number]: RecognitionResult | undefined };
}
interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionConstructor = new () => Recognition;

export const SPEECH_LANG = "es-CO";

function recognitionConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function isSpeechSupported(): boolean {
  return recognitionConstructor() !== undefined;
}

/** Listens with the Web Speech API (es-CO), reporting interim and final text. */
export function startListening(handlers: ListenHandlers): () => void {
  const Ctor = recognitionConstructor();
  if (!Ctor) {
    handlers.onError("El reconocimiento de voz no está disponible en este navegador.");
    handlers.onEnd();
    return () => undefined;
  }
  const recognition = new Ctor();
  recognition.lang = SPEECH_LANG;
  recognition.interimResults = true;
  recognition.continuous = false;
  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result?.[0]?.transcript ?? "";
      if (result?.isFinal) handlers.onFinal(text.trim());
      else interim += text;
    }
    if (interim) handlers.onInterim(interim.trim());
  };
  recognition.onerror = (event) => handlers.onError(`Error de reconocimiento de voz: ${event.error}`);
  recognition.onend = () => handlers.onEnd();
  recognition.start();
  return () => recognition.stop();
}

export const speechInput: InputSource = {
  get supported() {
    return isSpeechSupported();
  },
  start: startListening,
};

export function isSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Reads `text` aloud in Spanish (no-op when speech synthesis is unavailable). */
export function speak(text: string): void {
  if (!isSynthesisSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANG;
  window.speechSynthesis.speak(utterance);
}

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
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionConstructor = new () => Recognition;

export const SPEECH_LANG = "es-CO";
export const SILENCE_TIMEOUT_MS = 7_000;

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

/** Keeps one dictation session alive across browser restarts, until seven seconds of silence. */
// Propuesta §4.1: adaptador de entrada. La Web Speech API transcribe la voz;
// las expresiones regulares y los autómatas se ejecutan después, en src/core/.
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
  recognition.continuous = true;
  let stopping = false;
  let ended = false;
  let speaking = false;
  let silenceTimer: ReturnType<typeof setTimeout> | undefined;
  let endTimer: ReturnType<typeof setTimeout> | undefined;

  function finish() {
    if (ended) return;
    ended = true;
    clearTimeout(silenceTimer);
    clearTimeout(endTimer);
    handlers.onEnd();
  }

  function stop() {
    if (stopping || ended) return;
    stopping = true;
    clearTimeout(silenceTimer);
    // Allow the final result to arrive before releasing the session.
    endTimer = setTimeout(finish, 1_000);
    try {
      recognition.stop();
    } catch {
      finish();
    }
  }

  function waitForSilence() {
    clearTimeout(silenceTimer);
    if (!stopping && !ended) silenceTimer = setTimeout(stop, SILENCE_TIMEOUT_MS);
  }

  function start() {
    try {
      recognition.start();
    } catch {
      handlers.onError("No se pudo iniciar el micrófono. Intente dictar de nuevo.");
      finish();
    }
  }

  recognition.onspeechstart = () => {
    speaking = true;
    clearTimeout(silenceTimer);
    silenceTimer = undefined;
  };
  recognition.onspeechend = () => {
    speaking = false;
    waitForSilence();
  };
  recognition.onresult = (event) => {
    if (ended) return;
    if (!speaking) waitForSilence();
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result?.[0]?.transcript ?? "";
      if (result?.isFinal) handlers.onFinal(text.trim());
      else interim += text;
    }
    if (interim) handlers.onInterim(interim.trim());
  };
  recognition.onerror = (event) => {
    if (ended || event.error === "no-speech") return;
    stopping = true;
    handlers.onError(`Error de reconocimiento de voz: ${event.error}`);
    finish();
  };
  recognition.onend = () => {
    if (stopping || ended) {
      finish();
      return;
    }
    speaking = false;
    // Some browsers close recognition between phrases even in continuous mode.
    // Preserve the silence deadline and the accumulated text when restarting.
    if (!silenceTimer) waitForSilence();
    start();
  };
  waitForSilence();
  start();
  return stop;
}

export const speechInput: InputSource = {
  get supported() {
    return isSpeechSupported();
  },
  start: startListening,
};

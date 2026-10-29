import { afterEach, describe, expect, it, vi } from "vitest";
import { isSpeechSupported, SPEECH_LANG, startListening } from "./voice";

class FakeRecognition {
  static last: FakeRecognition | undefined;
  lang = "";
  interimResults = false;
  continuous = true;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  started = false;
  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.onend?.();
  }
  emit(text: string, isFinal: boolean) {
    const result = Object.assign([{ transcript: text }], { isFinal });
    this.onresult?.({ resultIndex: 0, results: [result] });
  }
}

const handlers = () => ({ onInterim: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() });

afterEach(() => {
  vi.unstubAllGlobals();
  FakeRecognition.last = undefined;
});

describe("voice", () => {
  it("is unsupported without SpeechRecognition", () => {
    expect(isSpeechSupported()).toBe(false);
    const h = handlers();
    startListening(h);
    expect(h.onError).toHaveBeenCalledWith(expect.stringContaining("no está disponible"));
    expect(h.onEnd).toHaveBeenCalled();
  });

  it("uses webkitSpeechRecognition in es-CO and reports interim and final text", () => {
    vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
    expect(isSpeechSupported()).toBe(true);
    const h = handlers();
    const stop = startListening(h);
    const rec = FakeRecognition.last;
    expect(rec?.lang).toBe(SPEECH_LANG);
    expect(rec?.interimResults).toBe(true);
    expect(rec?.started).toBe(true);

    rec?.emit("arriendo el", false);
    expect(h.onInterim).toHaveBeenCalledWith("arriendo el");
    rec?.emit(" arriendo el lote 20 ", true);
    expect(h.onFinal).toHaveBeenCalledWith("arriendo el lote 20");
    rec?.onerror?.({ error: "no-speech" });
    expect(h.onError).toHaveBeenCalledWith("Error de reconocimiento de voz: no-speech");
    stop();
    expect(h.onEnd).toHaveBeenCalled();
  });
});

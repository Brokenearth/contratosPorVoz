import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSpeechSupported, SILENCE_TIMEOUT_MS, SPEECH_LANG, startListening } from "../../../src/ui/voice";

class FakeRecognition {
  static last: FakeRecognition;
  lang = "";
  interimResults = false;
  continuous = false;
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  constructor() {
    FakeRecognition.last = this;
  }
  emit(text: string, isFinal: boolean) {
    this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal })] });
  }
}
const handlers = () => ({ onInterim: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() });
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
function listen() {
  vi.stubGlobal("webkitSpeechRecognition", FakeRecognition);
  const h = handlers();
  const stop = startListening(h);
  return { h, stop, rec: FakeRecognition.last };
}

describe("voice", () => {
  it("reports unsupported browsers", () => {
    expect(isSpeechSupported()).toBe(false);
    const h = handlers();
    startListening(h);
    expect(h.onError).toHaveBeenCalledWith(expect.stringContaining("no está disponible"));
    expect(h.onEnd).toHaveBeenCalledOnce();
  });
  it("uses continuous es-CO dictation and delivers partial and final phrases", () => {
    const { rec, h, stop } = listen();
    expect(rec.lang).toBe(SPEECH_LANG);
    expect(rec.interimResults).toBe(true);
    expect(rec.continuous).toBe(true);
    rec.emit("arriendo el", false);
    rec.emit(" arriendo el lote 20 ", true);
    rec.emit(" de 8 hectáreas ", true);
    expect(h.onInterim).toHaveBeenCalledWith("arriendo el");
    expect(h.onFinal.mock.calls).toEqual([["arriendo el lote 20"], ["de 8 hectáreas"]]);
    stop();
    expect(h.onEnd).toHaveBeenCalledOnce();
  });
  it("stops after exactly seven seconds of silence and renews the deadline on results", () => {
    const { rec, h } = listen();
    vi.advanceTimersByTime(6_000);
    rec.emit("arriendo el lote", true);
    vi.advanceTimersByTime(SILENCE_TIMEOUT_MS - 1);
    expect(rec.stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(rec.stop).toHaveBeenCalledOnce();
    expect(h.onEnd).toHaveBeenCalledOnce();
  });
  it("does not time out while the person is speaking", () => {
    const { rec } = listen();
    rec.onspeechstart?.();
    vi.advanceTimersByTime(15_000);
    expect(rec.stop).not.toHaveBeenCalled();
    rec.onspeechend?.();
    vi.advanceTimersByTime(6_999);
    expect(rec.stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(rec.stop).toHaveBeenCalledOnce();
  });
  it("restarts premature browser endings without shortening or resetting the existing pause", () => {
    const { rec, h } = listen();
    rec.emit("primera frase", true);
    vi.advanceTimersByTime(4_000);
    rec.onend?.();
    expect(rec.start).toHaveBeenCalledTimes(2);
    expect(h.onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2_999);
    expect(rec.stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(rec.stop).toHaveBeenCalledOnce();
    expect(h.onEnd).toHaveBeenCalledOnce();
  });
  it("rearms the silence deadline if a browser ends during speech", () => {
    const { rec } = listen();
    rec.onspeechstart?.();
    rec.onend?.();
    vi.advanceTimersByTime(SILENCE_TIMEOUT_MS);
    expect(rec.stop).toHaveBeenCalledOnce();
  });
  it("treats no-speech as recoverable but ends on permission errors", () => {
    const { rec, h } = listen();
    rec.onerror?.({ error: "no-speech" });
    rec.onend?.();
    expect(h.onError).not.toHaveBeenCalled();
    rec.onerror?.({ error: "not-allowed" });
    rec.onend?.();
    expect(h.onError).toHaveBeenCalledWith(expect.stringContaining("not-allowed"));
    expect(h.onEnd).toHaveBeenCalledOnce();
    expect(rec.start).toHaveBeenCalledTimes(2);
  });
  it("manual stop is immediate, idempotent and cancels automatic restarts", () => {
    const { rec, h, stop } = listen();
    stop();
    stop();
    rec.onend?.();
    vi.advanceTimersByTime(15_000);
    expect(rec.stop).toHaveBeenCalledOnce();
    expect(rec.start).toHaveBeenCalledOnce();
    expect(h.onEnd).toHaveBeenCalledOnce();
    rec.emit("late result", true);
    expect(h.onFinal).not.toHaveBeenCalled();
  });
  it("releases a session even if the browser never reports its end", () => {
    const { rec, h, stop } = listen();
    rec.stop.mockImplementation(() => undefined);
    stop();
    expect(h.onEnd).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(h.onEnd).toHaveBeenCalledOnce();
  });
  it("reports synchronous recognition startup failures", () => {
    class Broken extends FakeRecognition {
      start = vi.fn(() => {
        throw new Error("unavailable");
      });
    }
    vi.stubGlobal("SpeechRecognition", Broken);
    const h = handlers();
    startListening(h);
    expect(h.onError).toHaveBeenCalledWith(expect.stringContaining("No se pudo iniciar"));
    expect(h.onEnd).toHaveBeenCalledOnce();
  });
});

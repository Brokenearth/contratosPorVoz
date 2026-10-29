import { describe, expect, it } from "vitest";
import { BLANK, runMachine, stateFamily, type TuringMachine } from "./machine";

/** Replaces every "a" with "b" and accepts at the first blank. */
const aToB: TuringMachine = {
  start: "q0",
  accept: ["q_ok"],
  delta(state, symbol) {
    if (state !== "q0") return null;
    if (symbol === BLANK) return { next: "q_ok", write: BLANK, move: "S" };
    return { next: "q0", write: symbol === "a" ? "b" : symbol, move: "R" };
  },
};

/** Never halts: walks right forever. */
const forever: TuringMachine = {
  start: "q0",
  accept: [],
  delta: (_state, symbol) => ({ next: "q0", write: symbol, move: "R" }),
};

describe("runMachine", () => {
  it("runs transitions until an accepting state", () => {
    const run = runMachine(aToB, ["a", "x", "a"]);
    expect(run.accepted).toBe(true);
    expect(run.output).toBe("bxb");
    expect(run.steps).toBe(4);
  });

  it("rejects when no transition is defined", () => {
    const run = runMachine({ ...aToB, start: "q_missing" }, ["a"]);
    expect(run.accepted).toBe(false);
  });

  it("respects maxSteps", () => {
    const run = runMachine(forever, ["a"], { maxSteps: 25 });
    expect(run.accepted).toBe(false);
    expect(run.steps).toBe(25);
    expect(run.snapshots.at(-1)?.note).toContain("maxSteps");
  });

  it("extends the tape to the left when moving past cell 0", () => {
    const left: TuringMachine = {
      start: "q0",
      accept: ["q_ok"],
      delta: (state) =>
        state === "q0" ? { next: "q1", write: "x", move: "L" } : { next: "q_ok", write: "y", move: "S" },
    };
    const run = runMachine(left, ["a"]);
    expect(run.output).toBe("yx");
  });

  it("takes a snapshot at the start and on every state-family change", () => {
    const run = runMachine(aToB, ["a", "a"]);
    expect(run.snapshots.map((s) => s.state)).toEqual(["q0", "q_ok"]);
    expect(run.snapshots[0]?.tape).toEqual(["a", "a"]);
  });

  it("can also sample every N steps", () => {
    const run = runMachine(forever, ["a"], { maxSteps: 10, sampleEvery: 5 });
    expect(run.snapshots.length).toBeGreaterThanOrEqual(3);
  });
});

describe("stateFamily", () => {
  it("drops the bracketed parameter of a state", () => {
    expect(stateFamily("q_leer[raza]")).toBe("q_leer");
    expect(stateFamily("q_fin")).toBe("q_fin");
  });
});

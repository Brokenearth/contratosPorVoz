import { describe, expect, it } from "vitest";
import { compileRegex, nfaAccepts, parseRegex, runDfa, thompson, toDot } from "../../../../src/core/regex/index";

const DEFS = { DIGITO: "0|1|2|3|4|5|6|7|8|9", NUM: "DIGITO DIGITO*" };

describe("parseRegex", () => {
  it("parses alternation with lambda", () => {
    expect(parseRegex("s|λ")).toEqual({ kind: "union", options: [{ kind: "char", char: "s" }, { kind: "lambda" }] });
  });

  it("treats a lowercase word as a concatenation of characters", () => {
    expect(parseRegex("ab")).toEqual({
      kind: "concat",
      parts: [
        { kind: "char", char: "a" },
        { kind: "char", char: "b" },
      ],
    });
  });

  it("expands named definitions", () => {
    expect(parseRegex("DIGITO*", DEFS).kind).toBe("star");
  });

  it.each([
    ["(ab", "Falta ')'"],
    ["ab)", "')' sin '('"],
    ["a||b", "Alternativa vacía"],
    ["X", "Definición desconocida: X"],
    ["*a", "Se esperaba un símbolo"],
  ])("reports syntax error for %s", (source, message) => {
    expect(() => parseRegex(source)).toThrow(message);
  });

  it("detects cyclic definitions", () => {
    expect(() => parseRegex("A", { A: "B", B: "A" })).toThrow("Definición cíclica");
  });
});

describe("thompson", () => {
  it("builds the expected NFA-λ for s|λ", () => {
    const nfa = thompson(parseRegex("s|λ"));
    expect(nfa.states).toEqual(["q0", "q1", "q2", "q3", "q4", "q5"]);
    expect(nfa.initial).toBe("q0");
    expect(nfa.accepting).toEqual(["q5"]);
    expect(nfa.alphabet).toEqual(["s"]);
    expect(nfa.transitions).toEqual([
      { from: "q0", symbol: "λ", to: "q1" },
      { from: "q0", symbol: "λ", to: "q2" },
      { from: "q1", symbol: "s", to: "q3" },
      { from: "q2", symbol: "λ", to: "q4" },
      { from: "q3", symbol: "λ", to: "q5" },
      { from: "q4", symbol: "λ", to: "q5" },
    ]);
  });
});

describe("subset construction", () => {
  const samples = ["", "a", "b", "ab", "abc", "abbc", "ac", "c", "ba", "abbbb", "aabc", "abcc"];

  it.each(["ab+c?", "(a|b)*c", "a(b|λ)c*", "((a|b)(a|b))*"])("DFA of %s is equivalent to its NFA", (source) => {
    const { nfa, dfa } = compileRegex(source);
    for (const sample of samples) {
      expect(runDfa(dfa, sample).accepted, `${source} on "${sample}"`).toBe(nfaAccepts(nfa, sample));
    }
  });

  it("names DFA states D0.. and records their NFA subsets", () => {
    const { nfa, dfa } = compileRegex("s|λ");
    expect(dfa.initial).toBe("D0");
    expect(dfa.subsets["D0"]).toEqual(["q0", "q1", "q2", "q4", "q5"]);
    expect(dfa.accepting).toContain("D0");
    expect(nfa.states.length).toBe(6);
  });
});

describe("runDfa", () => {
  const num = compileRegex("NUM", DEFS).dfa;
  const animal = compileRegex("(vaca|toro|caballo|cabra|oveja|cerdo)(s|λ)").dfa;

  it("accepts 20 as NUM visiting one state per symbol", () => {
    const run = runDfa(num, "20");
    expect(run.accepted).toBe(true);
    expect(run.states).toHaveLength(3);
    expect(run.states[0]).toBe("D0");
  });

  it("rejects empty or non numeric strings", () => {
    expect(runDfa(num, "").accepted).toBe(false);
    expect(runDfa(num, "2a").accepted).toBe(false);
  });

  it.each([
    ["vacas", true],
    ["vaca", true],
    ["toros", true],
    ["vac", false],
    ["vacass", false],
  ])("ANIMAL on %s → %s", (input, expected) => {
    expect(runDfa(animal, input).accepted).toBe(expected);
  });
});

describe("toDot", () => {
  it("renders a Graphviz digraph with accepting states", () => {
    const dot = toDot(compileRegex("s|λ").nfa);
    expect(dot).toContain("digraph");
    expect(dot).toContain('"q5" [shape=doublecircle]');
    expect(dot).toContain('"q1" -> "q3" [label="s"]');
  });
});

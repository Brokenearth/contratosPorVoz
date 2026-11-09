/**
 * Parser for regular expressions written in the course notation:
 *   alternation `|`, concatenation by juxtaposition, `*`, `+`, `?`, parentheses,
 *   `λ` for the empty string and UPPERCASE names that reference other definitions.
 * Lowercase words are concatenations of single characters ("vaca" = v a c a).
 * Whitespace only separates symbols; `\x` escapes a special character.
 */

export type RegexNode =
  | { kind: "char"; char: string }
  | { kind: "lambda" }
  | { kind: "concat"; parts: RegexNode[] }
  | { kind: "union"; options: RegexNode[] }
  | { kind: "star" | "plus" | "optional"; child: RegexNode };

export type Definitions = Readonly<Record<string, string>>;

export class RegexSyntaxError extends Error {}

type Operator = "|" | "*" | "+" | "?" | "(" | ")";

type RegexToken =
  | { kind: "char"; char: string; position: number }
  | { kind: "ref"; name: string; position: number }
  | { kind: "lambda"; position: number }
  | { kind: "op"; op: Operator; position: number };

const OPERATORS: readonly string[] = ["|", "*", "+", "?", "(", ")"];
const WHITESPACE: readonly string[] = [" ", "\t", "\n", "\r"];

function isUpper(ch: string): boolean {
  return ch >= "A" && ch <= "Z";
}

function isNameChar(ch: string): boolean {
  return isUpper(ch) || (ch >= "0" && ch <= "9") || ch === "_";
}

function scan(source: string): RegexToken[] {
  const tokens: RegexToken[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source.charAt(i);
    if (WHITESPACE.includes(ch)) {
      i++;
    } else if (ch === "λ") {
      tokens.push({ kind: "lambda", position: i++ });
    } else if (OPERATORS.includes(ch)) {
      tokens.push({ kind: "op", op: ch as Operator, position: i++ });
    } else if (ch === "\\") {
      if (i + 1 >= source.length) throw new RegexSyntaxError("Escape '\\' sin carácter al final");
      tokens.push({ kind: "char", char: source.charAt(i + 1), position: i });
      i += 2;
    } else if (isUpper(ch)) {
      const start = i;
      while (i < source.length && isNameChar(source.charAt(i))) i++;
      tokens.push({ kind: "ref", name: source.slice(start, i), position: start });
    } else {
      tokens.push({ kind: "char", char: ch, position: i++ });
    }
  }
  return tokens;
}

// Materia §5.1: convierte la notación de la ER en un árbol de operadores.
// Ejemplo: vaca(s|λ) contiene concatenación, unión y cadena vacía.
export function parseRegex(source: string, definitions: Definitions = {}): RegexNode {
  return parseWithStack(source, definitions, []);
}

function parseWithStack(source: string, definitions: Definitions, stack: string[]): RegexNode {
  const tokens = scan(source);
  let pos = 0;

  const isOp = (op: Operator): boolean => {
    const token = tokens[pos];
    return token !== undefined && token.kind === "op" && token.op === op;
  };

  function parseUnion(): RegexNode {
    const first = parseConcat();
    const options = [first];
    while (isOp("|")) {
      pos++;
      options.push(parseConcat());
    }
    return options.length === 1 ? first : { kind: "union", options };
  }

  function parseConcat(): RegexNode {
    const parts: RegexNode[] = [];
    while (pos < tokens.length && !isOp("|") && !isOp(")")) parts.push(parsePostfix());
    const [first] = parts;
    if (first === undefined) throw new RegexSyntaxError(`Alternativa vacía en "${source}"; use λ`);
    return parts.length === 1 ? first : { kind: "concat", parts };
  }

  function parsePostfix(): RegexNode {
    let node = parseAtom();
    for (;;) {
      if (isOp("*")) node = { kind: "star", child: node };
      else if (isOp("+")) node = { kind: "plus", child: node };
      else if (isOp("?")) node = { kind: "optional", child: node };
      else return node;
      pos++;
    }
  }

  function parseAtom(): RegexNode {
    const token = tokens[pos++];
    if (token === undefined) throw new RegexSyntaxError(`Expresión incompleta: "${source}"`);
    switch (token.kind) {
      case "char":
        return { kind: "char", char: token.char };
      case "lambda":
        return { kind: "lambda" };
      case "ref":
        return expandReference(token.name);
      case "op": {
        if (token.op !== "(") {
          throw new RegexSyntaxError(`Se esperaba un símbolo en la posición ${token.position} de "${source}"`);
        }
        const inner = parseUnion();
        if (!isOp(")")) throw new RegexSyntaxError(`Falta ')' en "${source}"`);
        pos++;
        return inner;
      }
    }
  }

  function expandReference(name: string): RegexNode {
    if (stack.includes(name)) throw new RegexSyntaxError(`Definición cíclica: ${[...stack, name].join(" → ")}`);
    const definition = definitions[name];
    if (definition === undefined) throw new RegexSyntaxError(`Definición desconocida: ${name}`);
    return parseWithStack(definition, definitions, [...stack, name]);
  }

  const tree = parseUnion();
  if (pos < tokens.length) throw new RegexSyntaxError(`')' sin '(' en "${source}"`);
  return tree;
}

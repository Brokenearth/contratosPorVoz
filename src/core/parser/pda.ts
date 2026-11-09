import type { ParseTree, PdaStep, Token } from "../types";
import { formatProduction, isNonterminal, productionOf } from "./grammar";
import { matches, predict } from "./predict";

/** A PDA step plus the grammar-symbol stack (top on the right). `stack` holds the nesting markers Z0/SUB. */
export interface PdaTraceStep extends PdaStep {
  symbols: string[];
}

export interface PdaRun {
  ok: boolean;
  tree: ParseTree | null;
  trace: PdaTraceStep[];
  errors: string[];
  /** Words skipped by panic-mode recovery (they did not start any clause). */
  warnings: string[];
}

interface Entry {
  symbol: string;
  node: ParseTree;
}

const OPEN_NESTING = '"cuales"';
const CLOSE_NESTING = '"fin"';
/** Panic mode: a token that cannot start any clause is skipped and the analysis goes on. */
const RECOVERY_SYMBOL = "CLAUSULA";

function describe(symbol: string): string {
  return symbol.startsWith('"') ? `'${symbol.slice(1, -1)}'` : symbol;
}

/**
 * Predictive pushdown automaton. It keeps two explicit stacks:
 *  - `stack`: grammar symbols still to derive (LL parsing);
 *  - `markers`: nesting levels, Z0 at the bottom and one SUB per open
 *    "de los cuales" (pushed on "cuales", popped on "fin"), as in proposal §5.2.
 * It accepts iff all input is consumed, the symbol stack is empty and markers = [Z0].
 * Error recovery (panic mode): when no clause can start with the next token, that token is discarded with a
 * warning instead of rejecting the whole dictation; errors inside a clause still reject.
 */
// Materia §5.2: stack es la pila de símbolos pendientes de reconocer.
// Al expandir A → X Y se apila en orden inverso para procesar X primero.
// markers (Z0/SUB) es un registro auxiliar de anidamiento para la traza;
// no debe presentarse como una segunda pila independiente de un AP general.
export function runPda(start: string, tokens: Token[]): PdaRun {
  const root: ParseTree = { symbol: start, children: [] };
  const stack: Entry[] = [{ symbol: start, node: root }];
  const markers: string[] = ["Z0"];
  const trace: PdaTraceStep[] = [];
  const warnings: string[] = [];
  let pos = 0;

  const record = (action: string): void => {
    trace.push({
      input: tokens.slice(pos).map((t) => t.lexeme).join(" "),
      action,
      stack: [...markers],
      symbols: stack.map((e) => e.symbol),
    });
  };
  const reject = (message: string): PdaRun => {
    record(`RECHAZA: ${message}`);
    return { ok: false, tree: null, trace, errors: [message], warnings };
  };
  const unexpected = (token: Token, detail = ""): string =>
    `Token inesperado '${token.lexeme}' en la posición ${token.start}${detail}.`;

  record("inicio");
  for (let top = stack.pop(); top !== undefined; top = stack.pop()) {
    const la1 = tokens[pos];
    if (isNonterminal(top.symbol)) {
      const alternative = predict(top.symbol, la1, tokens[pos + 1]);
      if (alternative === null) {
        if (la1 === undefined) return reject(`Frase incompleta: falta completar ${top.symbol} (fin de la frase).`);
        if (matches(la1, CLOSE_NESTING) && markers.length === 1) {
          return reject(`'fin' sin 'de los cuales' en la posición ${la1.start}.`);
        }
        if (top.symbol !== RECOVERY_SYMBOL) return reject(unexpected(la1));
        warnings.push(`Se ignoró '${la1.lexeme}' en la posición ${la1.start}: no inicia ninguna cláusula.`);
        top.node.children = [{ symbol: "descartado", token: la1, children: [] }];
        pos++;
        record(`descarta '${la1.lexeme}' (recuperación en modo pánico)`);
        continue;
      }
      const production = productionOf(top.symbol, alternative);
      top.node.children = production.body.map((symbol) => ({ symbol, children: [] }));
      if (production.body.length === 0) top.node.children = [{ symbol: "λ", children: [] }];
      for (let i = production.body.length - 1; i >= 0; i--) {
        const child = top.node.children[i];
        const symbol = production.body[i];
        if (child !== undefined && symbol !== undefined) stack.push({ symbol, node: child });
      }
      record(formatProduction(production));
      continue;
    }
    const missingFin = top.symbol === CLOSE_NESTING ? ": falta 'fin' para cerrar 'de los cuales'" : "";
    if (la1 === undefined) {
      return reject(missingFin
        ? `Frase incompleta${missingFin} (fin de la frase).`
        : `Frase incompleta: se esperaba ${describe(top.symbol)} y llegó el fin de la frase.`);
    }
    if (!matches(la1, top.symbol)) return reject(unexpected(la1, missingFin));
    top.node.token = la1;
    pos++;
    if (top.symbol === OPEN_NESTING) {
      markers.push("SUB");
      record(`lee '${la1.lexeme}': apila SUB`);
    } else if (top.symbol === CLOSE_NESTING) {
      markers.pop();
      record(`lee '${la1.lexeme}': desapila SUB`);
    } else {
      record(`lee '${la1.lexeme}'`);
    }
  }
  const leftover = tokens[pos];
  if (leftover !== undefined) return reject(unexpected(leftover));
  if (markers.length !== 1) return reject("Frase incompleta: falta 'fin' para cerrar 'de los cuales'.");
  record("ACEPTA");
  return { ok: true, tree: root, trace, errors: [], warnings };
}

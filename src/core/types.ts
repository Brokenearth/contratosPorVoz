export type TokenType =
  | "NUM" | "ANIMAL" | "RAZA" | "UNIDAD_TIEMPO" | "UNIDAD_AREA" | "MES" | "MONEDA"
  | "VERBO" | "USO" | "CULTIVO" | "INSUMOS" | "PALABRA_CLAVE" | "CONECTOR" | "COMA" | "NOMBRE" | "DESCONOCIDO";
/** `synonymOf`: original words when the token comes from the synonym dictionary ("a partir del" → "desde"). */
export interface Token { type: TokenType; lexeme: string; value: string | number; start: number; end: number; synonymOf?: string }
export interface LexStep { position: number; tokenType: TokenType | null; dfaStates: string[]; accepted: boolean }
export interface LexResult { tokens: Token[]; trace: LexStep[]; errors: { position: number; lexeme: string; message: string }[] }

export interface AnimalItem { cantidad?: number; animal: string; raza?: string; sub?: AnimalItem[] }
export interface ContractFields {
  animales?: AnimalItem[]; lote?: string; hectareas?: number;
  fecha?: { dia: number; mes: number; anio?: number };
  valor?: { monto: number; moneda: string }; duracion?: { cantidad: number; unidad: string };
  uso?: string; cultivo?: string; insumos?: string; arrendador?: string; arrendatario?: string;
}
/** Stack top is the rightmost element. */
export interface PdaStep { input: string; action: string; stack: string[] }
export interface ParseTree { symbol: string; token?: Token; children: ParseTree[] }
export interface ParseResult { ok: boolean; tree: ParseTree | null; trace: PdaStep[]; fields: ContractFields; errors: string[] }

export interface TapeSnapshot { state: string; head: number; tape: string[]; note?: string }
export interface TuringRun { accepted: boolean; steps: number; snapshots: TapeSnapshot[]; output: string }
export interface TemplateDef { id: "PASTOREO" | "CULTIVO" | "MIXTA"; title: string; required: string[]; optional: string[]; body: string }
export interface SelectionResult { templateId: TemplateDef["id"] | null; scores: Record<string, { matched: number; total: number }>; tie: boolean; low: boolean; run: TuringRun }

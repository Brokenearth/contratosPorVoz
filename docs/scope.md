# Contratos Rurales por Voz — Alcance y contratos técnicos

Fuente: `docs/propuesta.pdf` (propuesta del 28-oct-2026). Este archivo es la **fuente de verdad** para implementar;
resume la propuesta y fija las decisiones que ella deja abiertas. Proyecto académico: simple y directo.

## Decisiones
- App web única: **Vite 7 + React 19 + TypeScript estricto + Tailwind CSS 4**, sin backend. Node 24, pnpm 9.
- Voz: **Web Speech API** del navegador (`SpeechRecognition`, `lang: es-CO`), detrás de una interfaz intercambiable
  `InputSource`; el cuadro de texto siempre funciona (plan B, §4.1). Instrucciones escritas; reconocimiento continuo con cierre tras 7 segundos de silencio.
- Núcleo formal en `src/core/` **sin React ni dependencias**: implementación propia (sin generadores, sin `RegExp` de JS
  para reconocer tokens) de: ER → AFN (Thompson) → AFD (subconjuntos) para el léxico; GLC + **autómata a pila** para el
  sintáctico; **máquina de Turing** para la selección de plantilla y el relleno.
- Pruebas: Vitest (núcleo + componentes con React Testing Library) y Playwright E2E (la voz se simula con texto).
- Código en inglés, textos de UI y contratos en español. Sin `any`. ESLint + Prettier.
- Scripts: `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.

## Estructura
```
src/core/regex/      parser de ER propio, Thompson (AFN-λ), subconjuntos (AFD), minimización opcional
src/core/lexer/      definiciones de tokens (ER), AFD por token, tokenizador de coincidencia más larga + traza
src/core/parser/     gramática (§5.2 + §5.5), AP con pila explícita y anticipación, AST, extracción de campos
src/core/turing/     máquina de Turing genérica (cinta, cabeza, estados, traza), MT de selección, MT de relleno
src/core/templates/  plantillas .md con declaración de campos (pastoreo, cultivo, mixta)
src/core/pipeline.ts runPipeline(texto) → resultado con todas las trazas
src/core/dialog.ts   guía inicial y preguntas por campos faltantes (§5.6)
src/ui/              React: entrada voz/texto, tokens, árbol + pila, cinta de la MT, contrato, descarga .md
e2e/                 Playwright
docs/                informe con ER, AFN/AFD, gramática, AP y MT (entregable 2) + 3 contratos de demo (entregable 3)
```

## Contratos entre módulos (`src/core/types.ts`)
```ts
type TokenType =
  | "NUM" | "ANIMAL" | "RAZA" | "UNIDAD_TIEMPO" | "UNIDAD_AREA" | "MES" | "MONEDA"
  | "VERBO" | "USO" | "CULTIVO" | "INSUMOS" | "PALABRA_CLAVE" | "CONECTOR" | "COMA" | "NOMBRE" | "DESCONOCIDO";
interface Token { type: TokenType; lexeme: string; value: string | number; start: number; end: number }
interface LexStep { position: number; tokenType: TokenType | null; dfaStates: string[]; accepted: boolean }
interface LexResult { tokens: Token[]; trace: LexStep[]; errors: { position: number; lexeme: string; message: string }[] }

interface AnimalItem { cantidad?: number; animal: string; raza?: string; sub?: AnimalItem[] }
interface ContractFields {
  animales?: AnimalItem[]; lote?: string; hectareas?: number;
  fecha?: { dia: number; mes: number; anio?: number };
  valor?: { monto: number; moneda: string }; duracion?: { cantidad: number; unidad: string };
  uso?: string; cultivo?: string; insumos?: string; arrendador?: string; arrendatario?: string;
}
interface PdaStep { input: string; action: string; stack: string[] }   // pila tope a la derecha
interface ParseTree { symbol: string; token?: Token; children: ParseTree[] }
interface ParseResult { ok: boolean; tree: ParseTree | null; trace: PdaStep[]; fields: ContractFields; errors: string[] }

interface TapeSnapshot { step: number; state: string; head: number; tape: string[]; note?: string }
interface TuringRun { accepted: boolean; steps: number; snapshots: TapeSnapshot[]; output: string }
interface TemplateDef { id: "PASTOREO" | "CULTIVO" | "MIXTA"; title: string; required: string[]; optional: string[]; body: string }
interface SelectionResult { templateId: TemplateDef["id"] | null; scores: Record<string, { matched: number; total: number }>; tie: boolean; low: boolean; run: TuringRun }
```
Las trazas (`snapshots`) pueden muestrearse (p. ej. cada N pasos + eventos clave) para no crecer sin límite; toda
ejecución tiene `maxSteps`.

## Requisitos funcionales (criterios de aceptación)
1. **Léxico (§5.1)**: tokens definidos como ER escritas en notación de la materia (`DIGITO`, `NUM = DIGITO DIGITO*`,
   `ANIMAL = (vaca|toro|caballo|cabra|oveja|cerdo|ternera|novillo)(s|λ)`, razas comunes: holstein, gir, normando,
   brahman, jersey, angus, cebú…; meses; unidades: días/meses/años, hectáreas; moneda: pesos/millones; usos; cultivos:
   maíz, café, papa, plátano, yuca, frijol…). Cada ER se compila con Thompson a AFN-λ y por subconjuntos a AFD; el
   tokenizador usa los AFD (coincidencia más larga, prioridad por orden). Normaliza tildes/mayúsculas. Expone AFN y AFD
   para mostrarlos. Palabras desconocidas → `NOMBRE` (para nombres de lote/partes) o `DESCONOCIDO`.
2. **Sintáctico (§5.2, §5.5)**: gramática de cláusulas en cualquier orden (`CONTRATO → CLAUSULA CONTRATO | λ`) con
   ANIMALES (lista con `,`/`y`, `de raza`, anidación `de los cuales … fin`), LOTE (`lote ID`/`en el lote ID`, ID numérico
   o nombre como "La Esperanza", `de N hectáreas`), VALOR, FECHA (`desde el 15 de noviembre (de 2026)`), DURACION, USO,
   CULTIVO, INSUMOS, PARTES (`arrendador NOMBRE`, `arrendatario NOMBRE`), VERBO. Implementada como **AP** con pila
   explícita y anticipación de 1–2 tokens (la ambigüedad de "por"/"lote 20 vs 20 toros" se resuelve como en §5.5).
   Produce árbol de derivación, traza de la pila (apila SUB en "de los cuales", desapila en "fin"), campos y errores
   claros (p. ej. "fin" sin "de los cuales" → rechazo con mensaje). Las 3 frases de §5.5 dan los mismos campos.
3. **Diálogo (§5.6)**: guía inicial; campos requeridos leídos de la plantilla (no fijos en código); preguntar solo
   por lo que falta; la respuesta se analiza y se **fusiona** con lo ya detectado hasta completar.
4. **Selección (§5.4)** con una **MT** cuya cinta contiene los campos extraídos y los marcadores de cada plantilla;
   cuenta coincidencias y elige la mayor; empate o coincidencia baja ⇒ pregunta por faltantes.
5. **Generación (§5.3)** con una **MT** de reemplazo (`q_buscar`, `q_leer`, `q_borrar`, `q_escribir`, `q_fin`) sobre la
   plantilla: sustituye `{{campo}}`, deja `{{campo}}` pendiente si falta un obligatorio, y **borra** la sección de una
   cláusula opcional ausente (marcada `[[?campo]] … [[/campo]]`). Salida `.md` descargable.
6. **Plantillas (§6)**: PASTOREO, CULTIVO, MIXTA con cláusulas fijas (objeto, destinación, duración, precio y forma de
   pago, obligaciones de las partes, terminación y resolución de conflictos).
   El ejemplo de §6 produce la CLÁUSULA SEGUNDA indicada.
7. **UI**: entrada por voz (botón micrófono, texto reconocido editable antes de generar, §9) o texto; visualización de
   tokens, AFD de un token, árbol de derivación, traza de la pila, cinta de la MT paso a paso (play/pausa/paso), puntajes
   de plantillas, contrato renderizado y descarga `.md`; frases de ejemplo.
8. **Calidad y entregables**: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` en verde;
   E2E con al menos 3 contratos generados (pastoreo, cultivo, mixta) incluyendo el diálogo de faltantes;
   `docs/informe.md` con ER, AFN/AFD (de NUM y ANIMAL, generados por el propio código), gramática, AP y MT;
   `docs/contratos-demo/*.md`; `README.md` con cómo instalar, correr y hacer la demo.

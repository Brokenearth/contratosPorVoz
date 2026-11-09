# Guía para el adelanto: de la propuesta al código

## Qué se puede afirmar sobre el avance

La arquitectura y los temas principales de la propuesta están implementados: entrada por voz o
texto, análisis léxico con ER/AFN/AFD, gramática, análisis con pila, extracción de campos,
selección de plantilla y generación del contrato. Hay tres plantillas y vistas de las trazas.

El cumplimiento no es total en el sentido formal de la propuesta. La máquina de selección compara
y cuenta coincidencias, pero la elección de la ganadora la hace TypeScript. Además, las máquinas
usan estados parametrizados y símbolos compuestos que necesitan una formalización adicional para
presentarlas como máquinas de Turing clásicas con conjuntos finitos y fijos de estados y símbolos.

El contraste se hizo contra la propuesta adjunta, especialmente sus secciones 4, 5 y 6.
Esto permite justificar los temas que ella enumera; el nivel de formalización exigido en la
asignatura deberá contrastarse con lo que pida el docente.

## Dónde abrir el código

Los comentarios que comienzan con `Materia` indican los puntos de la explicación.

| Tema | Archivo y función para mostrar |
| --- | --- |
| Recorrido general | [src/core/pipeline.ts:37](../src/core/pipeline.ts#L37) |
| Expresiones regulares | [src/core/lexer/definitions.ts:20](../src/core/lexer/definitions.ts#L20) |
| Árbol de una ER | [src/core/regex/parser.ts:67](../src/core/regex/parser.ts#L67) |
| AFN de Thompson | [src/core/regex/nfa.ts:35](../src/core/regex/nfa.ts#L35) |
| Conversión AFN → AFD | [src/core/regex/dfa.ts:12](../src/core/regex/dfa.ts#L12) |
| Reconocimiento de tokens | [src/core/lexer/lexer.ts:45](../src/core/lexer/lexer.ts#L45) |
| Gramática libre de contexto | [src/core/parser/grammar.ts:30](../src/core/parser/grammar.ts#L30) |
| Anticipación de tokens | [src/core/parser/predict.ts:39](../src/core/parser/predict.ts#L39) |
| Autómata a pila | [src/core/parser/pda.ts:46](../src/core/parser/pda.ts#L46) |
| Extracción semántica | [src/core/parser/fields.ts:142](../src/core/parser/fields.ts#L142) |
| Motor de Turing | [src/core/turing/machine.ts:49](../src/core/turing/machine.ts#L49) |
| Comparación y selección | [src/core/turing/selection.ts:86](../src/core/turing/selection.ts#L86) |
| Llenado de plantilla | [src/core/turing/fill.ts:50](../src/core/turing/fill.ts#L50) |
| Diálogo por faltantes | [src/core/dialog.ts:104](../src/core/dialog.ts#L104) |
| Adaptador de voz | [src/ui/voice.ts:63](../src/ui/voice.ts#L63) |

## Recorrido para explicar el proyecto

### 1. Empezar por `runPipeline`

Esta función permite mostrar el recorrido completo sin entrar primero en React:

```ts
const lex = tokenize(text);
const parse = parseContract(lex.tokens);
const fields = mergeFields(previousFields, parse.fields);
const selection = selectTemplate(extractedFieldNames(fields), TEMPLATES);
```

Después se comprueban los campos requeridos y se llama a `fillTemplate` cuando corresponde.
La voz ya se convirtió a texto antes de ejecutar esta función.

Puedes decir: «El proyecto trabaja sobre una descripción de un arriendo. Cada etapa recibe una
representación y produce la que necesita la siguiente: texto, tokens, árbol, campos y documento».

### 2. Expresiones regulares, AFN y AFD

En `lexer/definitions.ts`, `NAMED_DEFINITIONS` define `DIGITO` y `NUM = DIGITO DIGITO*`.
La primera aparición de DIGITO es obligatoria; la estrella permite cero o más dígitos adicionales.
La definición de ANIMAL se construye con alternativas de palabras y terminaciones opcionales.
`λ` representa la cadena vacía, por ejemplo para admitir el singular sin agregar una «s».

En `regex/parser.ts`, `parseRegex` convierte la expresión en un árbol con nodos `char`, `concat`,
`union`, `star`, etc. En `regex/nfa.ts`, `thompson` transforma ese árbol en fragmentos de AFN unidos
por transiciones λ. La unión abre caminos alternativos; la concatenación enlaza fragmentos;
la estrella añade el ciclo y el camino que permite cero repeticiones.

En `regex/dfa.ts`, `subsetConstruction` construye estados que representan conjuntos del AFN.
`lambdaClosure` encuentra los estados alcanzables sin consumir entrada y `move` sigue un símbolo.
Un conjunto es final si contiene un estado final del AFN. `compileRegex`, en `regex/index.ts`,
conecta esas tres operaciones.

Finalmente, `lexer/lexer.ts` usa `longestMatch` sobre los AFD para encontrar el token más largo.
Si dos definiciones empatan, gana la que aparece antes. Se conserva el lexema original, su tipo,
su valor y la posición. Los sinónimos se normalizan después mediante un diccionario.

**Demostración:** en la pestaña del AFD, elige ANIMAL y prueba `vacas`. Recorre las letras y observa
la aceptación. Cambia la cadena por `vacasx`: no hay transición para la «x» y se rechaza.
Este es el reconocimiento del token ANIMAL; en el analizador completo otra palabra podría
clasificarse como NOMBRE. No son la misma prueba.

El AFD almacena solamente las transiciones existentes. Una transición ausente representa rechazo;
si se exige una función de transición total, debe hacerse explícito el estado sumidero.

### 3. Gramática libre de contexto y pila

En `parser/grammar.ts`, cada producción tiene un no terminal a la izquierda y una secuencia de
símbolos a la derecha. La regla `CONTRATO → CLAUSULA CONTRATO | λ` permite una sucesión de cláusulas.
Por eso puede aparecer primero el lote, la duración o los animales, dentro de las formas admitidas.

La recursión importante está en `ITEM`, `SUBOPT` y `LISTA`:

```text
ITEM   → num animal RAZAOPT SUBOPT | animal RAZAOPT SUBOPT
SUBOPT → "de" "los" "cuales" LISTA "fin" | λ
LISTA  → ITEM RESTO
```

Una lista puede contener un ítem con otra lista. Para cerrar un grupo anidado hace falta recordar
qué quedó pendiente. Esa memoria la proporciona la pila.

En `parser/pda.ts`, `runPda` retira un símbolo con `stack.pop()`. Si es no terminal, busca una
producción y apila su cuerpo al revés, para que el primer símbolo quede en el tope y se procese
antes. Si es terminal, lo compara con el siguiente token y avanza en la entrada. El árbol se
construye al aplicar las producciones: es un árbol de derivación, no un AST reducido.

`parser/predict.ts` contiene una tabla manual que mira hasta dos tokens. Por ejemplo, «por» seguido
de un número inicia duración; «por» seguido de «un» inicia la construcción del valor. No se está
generando automáticamente una tabla FIRST/FOLLOW ni demostrando aquí que toda la gramática sea LL(2).

La pila principal es `stack`, de símbolos gramaticales. `markers`, con Z0 y SUB, registra el
anidamiento para la traza y sus comprobaciones; no se debe describir como un AP general con dos
pilas independientes. El cierre de los grupos también está exigido por las producciones.

**Demostración:** carga «Pastoreo anidado». En la pestaña Pila se observa Z0 → Z0 SUB → Z0 al leer
«cuales» y «fin». Si quitas «fin», la entrada no se acepta. El ejemplo se comprobó con el código.

### 4. Extraer datos y pedir lo que falta

`parser/fields.ts`, mediante `extractFields`, recorre el árbol. Un NUM bajo LOTE es el identificador
del lote; bajo ITEM representa cantidad de animales. Esto es extracción semántica, posterior al
reconocimiento de la estructura.

`dialog.ts` calcula `missingFields`, redacta `questionFor` y combina una respuesta mediante
`mergeFields`. Las plantillas declaran qué campos requieren. Es lógica de aplicación que apoya el
proceso; no hay que atribuirle otro modelo formal distinto.

**Demostración:** escribe:

> arriendo el lote El Porvenir de 3 hectáreas para cultivo de maíz por 6 meses,
> los insumos los aporta el arrendatario

El sistema pide la fecha y el valor. Responde:

> desde el 1 de diciembre de 2026 por un valor de 2 millones de pesos

El contrato se completa conservando los datos anteriores.

### 5. Máquina de Turing: distinguir el motor y las máquinas de dominio

En `turing/machine.ts`, `TuringMachine` declara el estado inicial, los de aceptación y `delta`.
La función `runMachine` ejecuta el ciclo:

```ts
const symbol = tape[head] ?? BLANK;
const transition = machine.delta(state, symbol);
tape[head] = transition.write;
state = transition.next;
head = moveHead(transition.move);
```

Esta es la lectura, escritura, cambio de estado y movimiento del cabezal. La cinta se amplía
cuando se necesita espacio. La memoria del equipo y `maxSteps` limitan la ejecución real.

En `turing/selection.ts`, `selectionTape` pone los campos detectados y los requeridos en la cinta.
`selectionMachine` los compara, marca coincidencias y escribe conteos unarios. Después,
`readTallies` interpreta la salida y `isBetter` compara proporciones para elegir la plantilla.
**Esta última decisión está fuera de la máquina de Turing.** Para cumplir literalmente que toda
la selección ocurra sobre la cinta faltaría implementar también esa comparación allí.

En `turing/fill.ts`, `fillMachine` define las operaciones de llenado:

```text
q_buscar → encuentra {{
q_leer[nombre] → lee el nombre hasta }}
q_borrar[nombre] → vuelve a la izquierda y borra el marcador
q_escribir[nombre] → escribe el valor y continúa
q_fin → acepta al llegar a ⊣
```

Las secciones opcionales tienen estados auxiliares que las conservan o eliminan según los datos.
La interfaz muestra las instantáneas del motor, no una secuencia dibujada por separado.

**Límite formal:** actualmente un nombre crece dentro de una cadena de estado, como
`q_leer[ar]`, y un valor completo puede ocupar una sola celda. Que una ejecución tenga longitud
finita no demuestra que Q y Γ sean conjuntos finitos y fijos para todas las entradas. Para una MT
clásica uniforme habría que acotar/compilar el control y representar nombres y valores mediante
una codificación fija en la cinta, con operaciones sobre sus símbolos. El mapa de valores también
se entrega desde TypeScript; la máquina no descubre por sí misma esos datos en otra cinta.

Una forma precisa de presentarlo es: «Tenemos un simulador con operaciones de máquina de Turing
para comparar campos y llenar plantillas. La formalización de los estados parametrizados y la
elección final dentro de la cinta son puntos pendientes del modelo».

No hace falta afirmar que sustituir marcadores solo se pueda resolver con una MT. Se eligió este
modelo para aplicar lectura, escritura y desplazamiento de una cinta dentro del proyecto académico.

## Por qué TypeScript y qué cambiaría con Python

La propuesta dejó el lenguaje por definir. TypeScript se eligió porque la aplicación tiene una
interfaz web con dictado, edición y visualizaciones, y puede ejecutarse en el navegador.

- La Web Speech API ya está disponible en navegadores compatibles. El adaptador está en `ui/voice.ts`;
  no se implementó un reconocedor de voz propio.
- El núcleo y la interfaz comparten tipos: `Token`, `ParseTree`, `ContractFields`, `Transition` y las
  trazas. Por ejemplo, `Move = "L" | "R" | "S"` permite detectar en compilación un movimiento mal escrito.
- Las uniones discriminadas de `RegexNode` permiten representar claramente cada operador de una ER.
- TypeScript se transforma en JavaScript. React muestra la interfaz y Vite construye archivos
  estáticos que se pueden desplegar en Netlify sin mantener un backend para este núcleo.

Python también permite implementar todos estos algoritmos y puede ser cómodo para un prototipo
de consola o ejercicios de teoría. En una aplicación web, la solución habitual sería poner el
núcleo Python en un servidor y comunicarlo con la interfaz JavaScript, o incorporar un entorno
Python en el navegador. Ambas opciones son posibles, pero agregan piezas que aquí no se necesitan.

La justificación no es que TypeScript tenga más capacidad computacional ni que Python no sirva.
Es que encaja con el medio elegido para demostrar el proyecto. Los tipos ayudan a detectar errores
de programación; no prueban que una gramática, un autómata o una transición sean correctos.

## Matices que conviene tener claros

- El sistema reconoce un vocabulario y unas estructuras definidas, no cualquier frase del español.
- El analizador tiene recuperación de errores: puede descartar palabras que no inician cláusulas
  y continuar con avisos. Aceptar tras esa recuperación no equivale a que el texto original pertenezca
  estrictamente a la gramática sin modificaciones.
- `runPipeline` decide generar a partir de campos disponibles o de la opción de forzar la generación;
  no usa `parse.ok` como condición directa. Esto importa especialmente al reutilizar datos anteriores.
- La comparación de plantillas se realiza por proporción de campos encontrados, no por significado
  general de la frase ni por un modelo de lenguaje.
- El grafo de Turing agrupa familias visitadas. Una instantánea puede saltar varias transiciones;
  la próxima transición mostrada se obtiene de `delta`, pero el botón avanza entre instantáneas.
- Los temas se implementan en `src/core/`. React, Vite, Playwright y Prettier son herramientas de
  interfaz, compilación o desarrollo, no temas formales adicionales de la propuesta.

## Orden sugerido para un adelanto de 7 minutos

1. **1 minuto:** problema rural y ejemplo de entrada; abrir `runPipeline`.
2. **1 minuto y medio:** mostrar una ER, Thompson y la construcción de subconjuntos. Probar `vacas` en el AFD.
3. **1 minuto y medio:** mostrar las producciones recursivas y el apilado de símbolos. Usar el ejemplo anidado.
4. **2 minutos:** mostrar el ciclo lectura/escritura/movimiento, el llenado y el límite de la selección actual.
5. **1 minuto:** justificar TypeScript y explicar los pendientes de formalización.

Si falla el micrófono, usa los ejemplos escritos: el núcleo formal recibe el mismo tipo de entrada.
La revisión comprobó las tres plantillas, el diálogo por faltantes, aceptación/rechazo del AFD de
ANIMAL y rechazo de la lista anidada sin «fin». Las pruebas automatizadas complementan estos ejemplos,
pero no sustituyen una demostración matemática del modelo.

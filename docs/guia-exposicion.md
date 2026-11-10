# Guía para la exposición · Del dictado al contrato

El proyecto transforma una descripción de arrendamiento rural en un borrador Markdown. El navegador transcribe la voz y el texto queda editable. A partir del texto, el núcleo ejecuta sus propios autómatas y máquinas, y la interfaz muestra las trazas de esa ejecución. Los datos de esta guía son ficticios.

## Recorrido principal

### 1. Voz y texto intercambiables

**Archivo y función.** [src/ui/voice.ts](../src/ui/voice.ts), `startListening` y `speechInput`. [src/ui/App.tsx](../src/ui/App.tsx), `analyze`.

~~~ts
recognition.lang = SPEECH_LANG;
recognition.interimResults = true;
recognition.continuous = true;
~~~

El adaptador usa `es-CO` y entrega resultados parciales y finales a `DictationField`. Tras siete segundos de silencio termina la escucha. Si se escribe «lote 20», o se dicta y se obtiene el mismo texto, al pulsar **Analizar** el punto de entrada es `runPipeline`. Las pruebas `tests/unit/ui/voice.test.ts` y `tests/e2e/contracts.spec.ts` simulan `SpeechRecognition`. Para comprobar micrófono real se requiere una ejecución aparte en Chrome o Edge con permiso, conexión y registro de la transcripción que produjo el navegador.

### 2. ER, AFN-λ de Thompson y AFD por subconjuntos

**Archivo y función.** [src/core/lexer/definitions.ts](../src/core/lexer/definitions.ts), `NAMED_DEFINITIONS` y `TOKEN_DEFINITIONS`. [src/core/regex/index.ts](../src/core/regex/index.ts), `compileRegex`. [src/core/lexer/lexer.ts](../src/core/lexer/lexer.ts), `tokenAutomata` y `bestMatch`.

~~~ts
const { nfa, dfa } = compileRegex(definition.regex, NAMED_DEFINITIONS);
return { definition, regex: definition.regex, nfa, dfa };
~~~

`parseRegex` convierte la ER en un árbol, `thompson` arma el AFN con transiciones λ y `subsetConstruction` construye estados que representan conjuntos del AFN. `bestMatch` ejecuta los AFD, conserva la coincidencia más larga y desempata por prioridad de definición. `20` da `NUM(20)` y `vacas` da `ANIMAL(vaca)`. En la vista del AFD de ANIMAL, `vacasx` rechaza al leer `x`. En el tokenizador completo puede pertenecer a la categoría `NOMBRE`. Las pruebas de `regex.test.ts` y `lexer.test.ts` comprueban ambas etapas.

Las equivalencias exactas se aplican a tokens en `applySynonyms`, de la frase más larga a la más corta. La forma canónica vuelve a pasar por los AFD y conserva el tramo original en `synonymOf`. La traza del escaneo corresponde a la entrada original.

### 3. Gramática, pila y árbol de derivación

**Archivo y función.** [src/core/parser/grammar.ts](../src/core/parser/grammar.ts), `grammar`. [src/core/parser/predict.ts](../src/core/parser/predict.ts), `predict`. [src/core/parser/pda.ts](../src/core/parser/pda.ts), `runPda`.

~~~text
CONTRATO → CLAUSULA CONTRATO | λ
SUBOPT   → "de" "los" "cuales" LISTA "fin" | λ
PARTES   → ART ROL ROLTAIL
~~~

Al expandir una producción, `runPda` apila su cuerpo en orden inverso y compara los terminales con la entrada. `predict` usa una tabla manual con uno o dos tokens de anticipación. Por ejemplo, «por» seguido de número abre duración y «por un» abre valor. El árbol se construye con las producciones usadas. En la traza, `symbols` muestra la pila de reconocimiento y `stack` registra `Z0/SUB` como comprobación de anidamiento.

Para `20 vacas de los cuales 5 terneras de los cuales 2 terneras fin fin y 3 caballos`, la pila de símbolos tiene dos cierres `fin` pendientes en el punto más profundo. Los marcadores recorren `Z0 → Z0 SUB → Z0 SUB SUB → Z0 SUB → Z0`. Al cerrar ambos grupos, los caballos quedan en la lista principal. `pipeline.test.ts` comprueba la lista anidada, la lista hermana y su Markdown.

### 4. Extracción y revisión de partes

**Archivo y función.** [src/core/lexer/parties.ts](../src/core/lexer/parties.ts), `groupPartyNames`. [src/core/parser/fields.ts](../src/core/parser/fields.ts), `extractFields`. [src/ui/PartyReview.tsx](../src/ui/PartyReview.tsx), `PartyReview`.

~~~ts
const name = text.slice(start.start, last.end);
grouped.push({ type: "NOMBRE", lexeme: name, value: name, start: start.start, end: last.end, partyName: true });
~~~

La agrupación contextual conserva el texto de un nombre ya escaneado por los AFD. La producción de partes consume el rol y el marcador `nombre` por separado. `extractFields` lee el `NOMBRE` desde el árbol. «Arrendador nombre Juan de la Cruz» guarda `Juan de la Cruz`. «Arrendataria nombre Ana Gómez» guarda `Ana Gómez`. «Arrendador Luis Toro» conserva `Toro` dentro del nombre. «El arrendador aporta los insumos» registra el proveedor. Si se dictan dos nombres diferentes para el mismo rol, el análisis pide revisión y deja libre la casilla.

| Estrategia | Uso en la exposición |
| --- | --- |
| Dictado con rol y `nombre` | Vía directa para capturar ambas partes y delimitar el nombre. Se conserva el formato «arrendador Juan Pérez» |
| Pregunta independiente por rol | Da contexto a una respuesta aislada. Es una alternativa de diálogo que exigiría un turno adicional por nombre |
| Casillas Arrendador y Arrendatario | Respaldo implementado para revisar, corregir o completar. La validación de nombres se comparte con la extracción. Una confirmación prevalece ante otro valor detectado en el mismo contrato |

La prueba de navegador corrige los nombres en las casillas y verifica los valores en Partes y Firmas del `.md`. Para una delimitación dudosa, usar una coma antes de la cláusula siguiente o confirmar el nombre en su casilla.

### 5. Selección en cinta

**Archivo y función.** [src/core/turing/selection.ts](../src/core/turing/selection.ts), `selectionTape`, `selectionMachine` y `selectTemplate`.

~~~ts
if (symbol === BLANK) return go("q_fin", verdict(tallies, domain), "S");
readTallyCell(tallies, symbol);
~~~

La cinta contiene los campos detectados y los marcadores requeridos de las tres plantillas. `q_comparar` contrasta cada marcador con los campos de entrada. `q_contar` escribe conteos unarios. En el flujo de la aplicación, `q_dominio` lee si hay tipo animal, cultivo o ambos. `q_resultado` lee los conteos y escribe `RESULT:<plantilla>:<empate>:<baja>`. La comparación proporcional usa productos cruzados. Sin evidencia de destino la cinta termina en `RESULT:-:0:1` y el diálogo pide animales o cultivo. Con ambos dominios el resultado apunta a MIXTA, incluso si faltan campos. En las pruebas de comparación general, un empate pendiente queda sin plantilla al invertir el orden. `selectTemplate` decodifica la celda final y `runPipeline` obtiene esa plantilla.

### 6. Diálogo, llenado y descarga

**Archivo y función.** [src/core/pipeline.ts](../src/core/pipeline.ts), `runPipeline`. [src/core/turing/machine.ts](../src/core/turing/machine.ts), `runMachine`. [src/core/turing/fill.ts](../src/core/turing/fill.ts), `fillMachine`. [src/ui/ContractPanel.tsx](../src/ui/ContractPanel.tsx), `download`.

~~~ts
const symbol = tape[head] ?? BLANK;
const transition = machine.delta(state, symbol);
~~~

El motor aplica `transition.write`, cambia al estado siguiente y mueve el cabezal. En el llenado, `q_buscar` detecta `{{`, `q_leer` reconoce el nombre del marcador, `q_borrar` vuelve hacia la izquierda y `q_escribir` escribe el valor. Las secciones `[[?campo]] … [[/campo]]` aparecen si tienen datos. Una fecha requerida sin dato conserva `{{fecha}}` y el archivo avisa que es un borrador incompleto. Solo un llenado aceptado se ofrece como nueva descarga. Un fallo de análisis o de llenado deja disponible la traza y, si ya existía un documento, la interfaz lo etiqueta **Borrador anterior**.

**Límite de la formalización.** Los dos controles usan estados parametrizados y símbolos compuestos. El llenado recibe un mapa de valores y la selección hace aritmética con los conteos en su control al escribir el veredicto. Para defender una MT clásica uniforme se necesita fijar Q y Γ, codificar datos en la cinta y descomponer la comparación y copia en transiciones elementales. Las trazas que se muestran son del motor usado para generar el resultado.

## Política académica de campos

El diálogo lee los requeridos del encabezado de cada plantilla. La fecha admite día y mes, como en el ejemplo completo de §5.6. Si se indica año, se valida con el calendario. §5.5 permite dictar una fecha sin año, que queda sin año en el borrador. Los nombres se pueden confirmar aparte y, si faltan, conservan espacios para completar.

| Plantilla | Requeridos | Opcionales y efecto |
| --- | --- | --- |
| Pastoreo | Lote, tipo de animal, fecha, uso ganadero, valor | Área, cantidad, raza y duración aparecen si se indican. La descripción de una lista se deriva de los animales |
| Cultivo | Lote, cultivo, fecha, valor | Área, insumos y duración aparecen si se indican |
| Mixta | Lote, tipo de animal, fecha, uso ganadero, cultivo, valor | Área, cantidad, raza, insumos y duración aparecen si se indican. La descripción de lista es derivada |

Con campos requeridos pendientes, se puede generar un borrador marcado como incompleto cuando la plantilla está identificada y el análisis es válido. El caso con datos requeridos completos mantiene la salida para revisión. El alcance es el borrador académico de la propuesta.

## Vocabulario y sugerencias

Los alias se definen en [src/core/lexer/synonyms.ts](../src/core/lexer/synonyms.ts). Las clases se reconocen en `TOKEN_DEFINITIONS`. Estos son los grupos que se pueden mostrar y sus límites.

| Clase | Forma canónica y variantes | Ejemplo o límite |
| --- | --- | --- |
| Animal | `bovinos` ← `vacunos`, `ganado bovino`. `novilla(s)` ← `vaquilla(s)`. `res(es)` conserva su propia categoría | «3 vacunos» conserva bovinos, con la especie concreta pendiente |
| Raza | `holstein` ← `holstein friesian`. `simmental` ← `simmenthal` | `gir` y `girolando` siguen siendo razas distintas |
| Cultivo | `frijol` admite grafía con o sin tilde. `banano`, `plátano` y `habichuela` se reconocen como cultivos distintos | «Para sembrar habichuela» usa el marco canónico «para cultivo de» |
| Uso | `para ceba` ← `para engorde` | `levante` conserva su propio uso |
| Mes | `septiembre` ← `setiembre` | Ambos dan mes 9 |
| Tiempo | Singular y plural de día, semana, quincena, mes y año | Dos quincenas conservan su unidad |
| Área | `hectáreas` ← `ha` tras «de» y una cantidad. `fanegada` y `cuadra` conservan su unidad | «Lote 20 de 8 fanegadas» imprime «8 fanegadas» |
| Moneda y escala | `pesos` ← `pesos colombianos`, `COP`, `pesos COP`. `mil` y `millón` se tratan como multiplicadores distintos | «900 mil pesos COP» imprime `$ 900.000 pesos` |
| Verbo | `arriendo` ← `rento`, `alquilamos`, `doy en arriendo`, `doy en alquiler`. `se arrienda` ← `se da en arriendo`, `se entrega en arriendo`, entre otros | Verbo inicial opcional |
| Conector | `y` y `e` admitidos como conjunciones | «3 caballos e insumos los aporta el arrendador» separa cláusulas |
| Insumos | `los insumos los aporta el <rol>` ← `el <rol> corre con los insumos`, `pone los insumos` o `suministra los insumos` en las formas registradas | Los proveedores siguen siendo dos roles distintos |
| Palabra clave | `desde el` ← `a partir del`. `lote` ← `predio`, `parcela` y variantes. `arrendador`/`arrendatario` tienen formas femeninas y alias de rol | `nombre` separa el rol del dato personal |
| Número, nombre y coma | Dígitos o palabras numéricas reconocidas, nombre original y separador literal | No se ofrecen correcciones aproximadas para estas clases |

**Distancia de Levenshtein.** [src/core/lexer/similarity.ts](../src/core/lexer/similarity.ts), `levenshtein` y `suggestBreedCorrections`. Solo busca entre razas conocidas cuando el AP rechazó una palabra desconocida tras un animal seguido de «de raza». Hasta cuatro letras se conserva el error original. De cinco a ocho se admite una edición y desde nueve se admiten dos. Si hay candidatos cercanos se ofrecen para confirmación. «20 vacas de raza holsten» sugiere `Holstein` con distancia 1. La interfaz conserva la transcripción original y vuelve a analizar el texto solo tras confirmar. Nombres, roles, identificadores, cifras, monedas y unidades quedan fuera de la búsqueda aproximada.

## Casos para mostrar en vivo

1. **Aceptado.** Dictar o pegar «Lote 20 para cultivo de maíz desde el 2 de marzo de 2027 valor 900 mil pesos, arrendador nombre Juan de la Cruz, arrendataria nombre Ana Gómez». Abrir Tokens y Pila, confirmar los nombres si se desea, abrir Selección y buscar `RESULT:CULTIVO:0:0`. En Llenado, seguir el cabezal hasta `q_fin`. Descargar `contrato-cultivo.md` y comprobar lote 20, maíz, `$ 900.000 pesos` y los dos nombres en Partes y Firmas.
2. **Rechazado.** Dictar o pegar «20 vacas de los cuales 5 terneras». Pila muestra el cierre pendiente, diagnóstico «falta 'fin' para cerrar 'de los cuales'» y sin documento nuevo. Con «20 vacas fin», mostrar el rechazo por cierre sobrante. La prueba del núcleo comprueba ambos y la prueba E2E verifica la conservación de un borrador previo ante un cierre inválido.
3. **Corrección con confirmación.** Usar «lote 20 para 4 vacas de raza holsten para ceba desde el 2 de marzo valor 900 mil pesos». Mostrar la sugerencia, pulsar **Confirmar Holstein** y comparar el `.md` con la transcripción conservada. Playwright cubre este caso con texto.

Conservar una demo de cada plantilla. Si se usa el micrófono en la exposición, registrar navegador, versión, permiso, dictado, transcripción original, correcciones y resultado por separado de la voz simulada.

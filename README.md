# Contratos rurales por voz

Aplicación web que redacta **borradores de contratos de arrendamiento rural** a partir de lo que una
persona dicta por voz (o escribe). Proyecto académico de Lenguajes de Programación: el texto pasa por
un analizador léxico hecho con **expresiones regulares → AFN (Thompson) → AFD (subconjuntos)**, un
analizador sintáctico con **gramática libre de contexto y autómata a pila**, y dos **máquinas de
Turing**: una elige la plantilla (pastoreo, cultivo o mixta) y otra la rellena. La interfaz muestra
los tokens, el AFD de un token, el árbol de derivación, la pila y la cinta de la MT paso a paso.

> El resultado es un borrador informativo y **no reemplaza la asesoría de un abogado**.

## Requisitos

- **Node.js 24** o superior.
- **pnpm 9** (`corepack enable` lo instala con la versión fijada en `package.json`).
- Para dictar por voz: **Google Chrome o Microsoft Edge** (Web Speech API, requiere internet y permiso
  de micrófono). En otros navegadores se usa el cuadro de texto.

## Instalación y ejecución

```bash
pnpm install
pnpm dev          # abre http://localhost:5173
```

Para una versión de producción: `pnpm build` y `pnpm preview`.

## Cómo usarla

1. **Voz:** pulse el botón del micrófono (_Dictar por voz_), dicte las condiciones y deténgalo al terminar. El
   texto reconocido aparece en el cuadro y **se puede corregir** antes de generar.
2. **Texto:** escriba la frase en el mismo cuadro, o elija una de las frases de ejemplo.
3. Genere el contrato. Si faltan datos obligatorios, el sistema pregunta solo por ellos
   (p. ej. "Falta la fecha y para qué se usará el lote."); responda por voz o texto y se fusionan con
   lo ya dicho.
4. Revise las pestañas de teoría (tokens, AFD, árbol, pila, cinta de la MT, puntajes de plantillas) y
   descargue el contrato en `.md`.

Puede mencionar los datos **en cualquier orden**: animales (cantidad, tipo y raza), lote (número o
nombre) y hectáreas, fecha de inicio, duración, valor, uso, cultivo, quién aporta los insumos y los
nombres del arrendador y del arrendatario.

También entiende **sinónimos** gracias a un diccionario (`src/core/lexer/synonyms.ts`). Por ejemplo:
- "a partir del" equivale a "desde el".
- "por un plazo de" equivale a "por".
- "finca" o "predio" equivalen a "lote".
- "por la suma de" equivale a "por un valor de".

Los montos se pueden dar en cifras ("$6.000.000 de pesos"). Si una palabra no encaja, se ignora con un
aviso y el resto se procesa igual. Ejemplo:

> Se arrienda por un período de 12 meses, a partir del 15 de noviembre de 2026, el lote denominado La
> Esperanza, con una extensión de 5 hectáreas, destinado al mantenimiento de 20 vacas de raza Holstein
> para producción de leche, por un valor de $6.000.000 de pesos.

## Guion de demostración (3 contratos)

1. **Pastoreo:**
   _"arriendo lote La Esperanza de 5 hectáreas para 20 vacas de raza holstein para producción de leche
   por 12 meses desde el 15 de noviembre de 2026 por un valor de 6 millones de pesos"_
   → muestre los tokens, el AFD de `ANIMAL` y la selección PASTOREO.
2. **Cultivo con diálogo de faltantes:** dicte primero
   _"arriendo el lote El Porvenir de 3 hectáreas para cultivo de maíz por 6 meses"_; el sistema pide quién
   aporta los insumos, la fecha y el valor. Responda
   _"desde el 1 de diciembre de 2026 por un valor de 2 millones de pesos, los insumos los aporta el
   arrendatario"_ → contrato CULTIVO.
3. **Mixta con anidación:**
   _"arriendo el lote 4 de 10 hectáreas para 15 vacas de raza gir para ganadería de leche y para
   cultivo de maíz por 1 año desde el 1 de marzo de 2027 por un valor de 8 millones de pesos, los
   insumos los aporta el arrendador"_ → contrato MIXTA.
4. **Pila (opcional):** elija la frase de ejemplo con _"20 vacas de raza holstein de los cuales 5
   terneras fin y 3 caballos …"_ y muestre en la traza del AP cómo la pila pasa de `Z0` a `Z0 SUB` y
   vuelve a `Z0`.

Los contratos resultantes de estas frases están en [`docs/contratos-demo/`](docs/contratos-demo/).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | servidor de desarrollo |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript estricto (`tsc --noEmit`) |
| `pnpm test` | pruebas unitarias y de componentes (Vitest) |
| `pnpm build` | typecheck + compilación de producción |
| `pnpm test:e2e` | pruebas extremo a extremo (Playwright; la primera vez: `pnpm exec playwright install chromium`) |
| `pnpm docs:generate` | regenera las tablas, diagramas y trazas del informe, `docs/automatas.md` y los contratos de demo usando el código real |

## Estructura

```text
src/core/regex/      parser de ER, Thompson (AFN-λ), subconjuntos (AFD)
src/core/lexer/      definiciones de tokens y tokenizador de coincidencia más larga
src/core/parser/     gramática, tabla de predicción, autómata a pila, extracción de campos
src/core/turing/     máquina de Turing genérica, MT de selección y MT de relleno
src/core/templates/  plantillas PASTOREO, CULTIVO y MIXTA (.md con campos declarados)
src/core/pipeline.ts texto → tokens → AP → campos → selección → contrato
src/core/dialog.ts   guía inicial y preguntas por campos faltantes
src/ui/              interfaz React (voz/texto, visualizaciones, descarga)
e2e/                 pruebas Playwright
scripts/             generador de la documentación (pnpm docs:generate)
docs/                propuesta, alcance, informe, autómatas y contratos de demo
```

## Documentación

- [Informe técnico](docs/informe.md) (entregable 2): ER, AFN/AFD, gramática, tabla de predicción,
  trazas del AP y de las MT, pruebas y limitaciones.
- [Autómatas completos](docs/automatas.md) de NUM, ANIMAL y MES, generados por el código.
- Contratos de demostración (entregable 3): [pastoreo](docs/contratos-demo/01-pastoreo.md),
  [cultivo](docs/contratos-demo/02-cultivo.md), [mixta](docs/contratos-demo/03-mixta.md).
- [Propuesta](docs/propuesta.pdf) y [alcance](docs/scope.md).

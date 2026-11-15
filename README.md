# Contratos Rurales por Voz

Aplicación web para preparar borradores de arrendamiento rural en español. Convierte una descripción dictada o escrita en un contrato de pastoreo, cultivo o uso mixto. Permite revisar los datos, resolver dudas de la transcripción y exportar el resultado en PDF o Markdown.

## Uso

1. Escribe o dicta las condiciones del acuerdo. Incluye el lote, la fecha de inicio, el valor total en pesos y el uso.
2. Revisa los datos reconocidos. Completa los campos obligatorios y confirma los nombres de las partes. Si se detectan términos ambiguos o condiciones que la aplicación no pudo interpretar, corrige el texto y vuelve a analizarlo.
3. Revisa el borrador y descárgalo en el formato que necesites.

> Arriendo el lote La Esperanza de 5 hectáreas para 20 vacas de raza Holstein, para producción de leche, por 12 meses desde el 15 de noviembre de 2026, por un valor de 6 millones de pesos.

El dictado usa el reconocimiento de voz del navegador y requiere permiso para acceder al micrófono. El análisis del texto y la generación del documento se ejecutan en el cliente.

## Inicio rápido

Requiere Node.js 24 o posterior y pnpm 9.15.9.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Vite muestra la dirección local en la terminal. Para preparar una compilación de producción, ejecuta `pnpm build`. El resultado se guarda en `dist/`.

## Arquitectura

| Módulo | Responsabilidad |
| --- | --- |
| `src/core/regex/` y `src/core/lexer/` | Compilan las expresiones regulares a AFN-λ por Thompson y a AFD por subconjuntos. Los AFD reconocen los tokens del contrato. |
| `src/core/parser/` | Usa una gramática libre de contexto y un autómata a pila para construir el árbol de derivación. La pila comprueba los cierres de grupos anidados. |
| `src/core/turing/` y `src/core/templates/` | Seleccionan la plantilla a partir de los campos y generan el Markdown mediante dos máquinas de Turing. |
| `src/ui/` | Presenta el dictado, la revisión, las descargas y el laboratorio de trazas. |

El laboratorio de la aplicación permite inspeccionar los tokens, la pila, el árbol y las cintas. Consulta la [especificación técnica](docs/scope.md), los [diagramas de autómatas](docs/automatas.md) y los [contratos de ejemplo](docs/contratos-demo/).

## Contribuir

Abre un issue con la entrada exacta, el resultado observado y el esperado. Para proponer un cambio, crea una rama a partir de `main`, incluye las pruebas de regresión y abre un pull request con commits por cambio.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Las pruebas de navegador simulan el reconocimiento de voz. Para regenerar los ejemplos y los diagramas, ejecuta `pnpm docs:generate`. Los detalles de ejecución y despliegue están en la [guía de desarrollo](docs/desarrollo.md).

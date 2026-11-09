# Carpetas, ejecución y despliegue

## Qué contiene cada carpeta

| Carpeta       | Contenido                                                                                             | Para qué se conserva                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/core/`   | Analizador léxico, expresiones regulares, gramática, autómata a pila, máquinas de Turing y plantillas | Es la implementación de los modelos descritos en la propuesta.       |
| `src/ui/`     | Pantallas, dictado y visualizaciones                                                                  | Permite usar la aplicación y mostrar los procesos en la exposición.  |
| `config/`     | Configuración de compilación y herramientas de desarrollo                                             | Centraliza los ajustes técnicos.                                     |
| `tests/unit/` | Pruebas del núcleo y de los componentes                                                               | Comprueban el análisis, la generación, el dictado y los simuladores. |
| `tests/e2e/`  | Pruebas con un navegador                                                                              | Verifican el uso completo, las descargas y la vista móvil.           |
| `scripts/`    | Generación de documentación                                                                           | Produce tablas, trazas y contratos de ejemplo a partir del código.   |
| `docs/`       | Propuesta, informe, diagramas, ejemplos y capturas                                                    | Reúne el material de apoyo y los entregables de la materia.          |

Los archivos de prueba están fuera de `src/` para que el código de la aplicación sea más fácil de recorrer.

## Los archivos de la raíz

- `index.html` es el punto de entrada de la página.
- `package.json` declara las dependencias, las versiones necesarias y los comandos del proyecto.
- `pnpm-lock.yaml` fija las versiones de las dependencias para que la instalación sea reproducible. Se debe conservar en Git.
- `tsconfig.json` configura la revisión de tipos del código de la aplicación y del generador de documentación.
- `netlify.toml` indica a Netlify cómo compilar la aplicación, qué carpeta publicar y cómo resolver las rutas.
- `.gitignore` evita subir dependencias instaladas, resultados de pruebas y archivos locales.
- `README.md` presenta el proyecto.
- `AGENTS.md` conserva las preferencias de trabajo y publicación indicadas por el propietario. No interviene en la ejecución ni en el despliegue.

## Por qué aparecen Vite, Playwright y Prettier

Cada herramienta tiene un trabajo distinto. Sus archivos de configuración están en `config/`:

| Herramienta                             | Función                                                        | ¿Hace falta para desplegar?              |
| --------------------------------------- | -------------------------------------------------------------- | ---------------------------------------- |
| Vite (`vite.config.ts`)                 | Ejecuta el servidor local y construye la página de producción. | Sí, durante la compilación.              |
| TypeScript (`tsconfig.json` en la raíz) | Revisa los tipos antes de compilar.                            | Sí, lo utiliza `pnpm build`.             |
| Vitest (`vitest.config.ts`)             | Ejecuta las pruebas unitarias y de componentes.                | No; se utiliza para comprobar cambios.   |
| Playwright (`playwright.config.ts`)     | Abre un navegador y prueba la aplicación.                      | No; solo se ejecuta con `pnpm test:e2e`. |
| ESLint (`eslint.config.js`)             | Revisa posibles problemas en el código.                        | No; se ejecuta con `pnpm lint`.          |
| Prettier (`prettier.json`)              | Mantiene un formato consistente al editar archivos.            | No; se ejecuta con `pnpm format`.        |

Estas herramientas se declaran como dependencias de desarrollo. Netlify necesita las herramientas de compilación al construir el proyecto, pero al visitante solo le entrega los archivos generados en `dist/`.

## Ejecutar en el equipo

Se necesita Node.js 24 y pnpm 9.15.9, la versión indicada en `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

La aplicación se abre en `http://localhost:5173`. El dictado utiliza el micrófono y el servicio de reconocimiento del navegador; también se puede escribir el texto.

Para comprobar los cambios:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Las comprobaciones adicionales se ejecutan por separado:

```bash
pnpm lint
pnpm exec playwright install chromium
pnpm test:e2e
```

`pnpm format` aplica formato a los archivos. `pnpm docs:generate` actualiza los ejemplos, diagramas y bloques generados del informe. Las pruebas de navegador guardan capturas en `docs/screenshots/` y sus resultados temporales en `test-results/`.

## Desplegar en Netlify

El archivo `netlify.toml` ya contiene los ajustes del proyecto:

- Carpeta base: raíz del repositorio.
- Comando de compilación: `pnpm run build`.
- Carpeta publicada: `dist`.
- Node.js: 24. pnpm: 9.15.9.

Netlify instala las dependencias y genera `dist/`. No se debe usar una instalación con `--prod` antes de compilar, porque Vite y TypeScript son dependencias de desarrollo necesarias para ese paso.

La aplicación es estática: esta versión no necesita un servidor de backend ni variables de entorno para generar los contratos. Para probar localmente la salida de producción:

```bash
pnpm build
pnpm preview
```

`node_modules/`, `dist/`, la cobertura y los resultados temporales de las pruebas se generan en cada equipo o durante el despliegue. Están excluidos de Git.

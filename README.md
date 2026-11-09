# Contratos rurales por voz

Proyecto de la materia Lenguajes de Programación que permite redactar contratos de
arrendamiento rural a partir de una descripción hablada o escrita.

La idea parte de una situación cotidiana en el campo: las condiciones de un arriendo se
conversan, pero llevar ese acuerdo a un documento puede resultar más complicado. Hay que
organizar los datos del lote, el uso que se le dará, el tiempo del arriendo y el valor
acordado. El proyecto busca facilitar ese paso, especialmente para personas que se sienten
más cómodas hablando que escribiendo o que tienen poca experiencia con herramientas digitales.

Una persona puede describir su acuerdo así:

> Arriendo el lote La Esperanza de 5 hectáreas para 20 vacas de raza Holstein,
> para producción de leche, por 12 meses desde el 15 de noviembre de 2026,
> por un valor de 6 millones de pesos.

A partir de esa descripción, el sistema identifica los datos y los organiza en una plantilla
de contrato. Si falta información, la solicita antes de completar el documento. Se trabajan
tres tipos de arrendamiento: para pastoreo, para cultivo y mixto.

## Relación con la materia

El proyecto permite seguir un mismo texto por varias etapas y observar qué aporta cada uno
de los modelos estudiados en clase.

Primero se realiza el análisis léxico. Las expresiones regulares definen las palabras y los
datos que interesa reconocer, como números, animales, razas o meses. A partir de ellas se
construyen autómatas finitos que recorren el texto y producen los tokens que recibirá el
analizador sintáctico.

Después, una gramática libre de contexto y un autómata a pila permiten analizar cómo se
relacionan esos tokens y extraer los campos del contrato. La pila también sirve para manejar
grupos anidados, como al mencionar un conjunto de animales y luego precisar cuántos pertenecen
a un subgrupo. Esto permite mostrar en un caso concreto para qué se necesita recordar
información durante el análisis.

Finalmente, las máquinas de Turing intervienen en la selección y el llenado de la plantilla.
Una compara los campos encontrados con los que requiere cada tipo de contrato. La otra
recorre la plantilla y reemplaza sus marcadores por los datos del acuerdo.

La aplicación muestra estos procesos mediante los tokens, el árbol de derivación, los
recorridos del AFD, las pilas y la cinta de las máquinas de Turing. Estas vistas permiten
seguir la ejecución paso a paso durante la explicación del proyecto.

## Uso de la aplicación

La entrada puede hacerse con el micrófono o escribiendo en el cuadro de texto. La transcripción
utiliza el reconocimiento de voz del navegador; el análisis del texto y los modelos formales
están implementados en el proyecto.

Los datos se pueden mencionar en distinto orden. Si hace falta alguno, se responde a la
pregunta del sistema y se conserva la información que ya se había reconocido. Al terminar,
el contrato se puede revisar, copiar o descargar en Markdown. También hay ejemplos de
pastoreo, cultivo y arrendamiento mixto para probar el proceso.

## Ejecutar el proyecto

La aplicación está desarrollada con TypeScript, React y Vite. Para ejecutarla se necesita
Node.js 24 o superior y pnpm 9.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

La aplicación estará disponible en `http://localhost:5173`. Para el dictado por voz se recomienda
Chrome o Edge, con conexión a internet y permiso para usar el micrófono.

## Documentación

La explicación detallada de la gramática, los autómatas y las máquinas de Turing está en el
[informe técnico](docs/informe.md). También se pueden consultar los
[diagramas de los autómatas](docs/automatas.md), la [propuesta del proyecto](docs/propuesta.pdf)
y los [contratos de ejemplo](docs/contratos-demo/).

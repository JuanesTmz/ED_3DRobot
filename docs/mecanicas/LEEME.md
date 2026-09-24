# Laboratorio de mecánicas · versión publicada

Copia estática del prototipo `Montaje/prototipos/mecanicas/` para publicarlo
en GitHub Pages y que los docentes prueben las mecánicas nuevas. Se entra
desde el inicio del sitio (`docs/index.html`) o directo a una estación con
`mecanicas/?estacion=N` (1 a 6).

## En qué se diferencia del prototipo

El prototipo vive en el repo Montaje y carga la expedición real por rutas
absolutas (`/apps/expedicion/...`), con un *import map* que cambia el motor y
la partida, y un servidor Node con LLM. Aquí no hay servidor, así que:

- **Todo va copiado en esta carpeta**, con rutas relativas y sin `<base>` ni
  import map: los módulos de `apps/expedicion/js/`, `guiones/estado.js`, los
  personajes (`character/`), los `.glb` del aula y solo las imágenes que usan
  las estaciones. `motor.js` y `partida.js` ya son los del laboratorio.
  three.js se comparte con el visor: `../vendor/three/`.
- **Sin LLM.** `js/api.js` devuelve `null` sin llamar a nada (ninguna
  estación lo usa). La estación 6 ya no llama a `/api/lab/ficha`: K-7 ordena
  el relato con reglas (`fichaPorReglas` en `js/mecanicas/ficha.js`), y la
  ventana avisa que en la experiencia real lo hará un modelo de lenguaje.
- **Menú de estaciones nuevo** (`iniciarLab` en `js/lab.js`). Reemplaza la
  bienvenida: una tarjeta por estación que entra directo, «Recorrer las seis
  en orden» y el ritmo del diálogo. Las tarjetas salen de la tarjeta de
  capítulo de cada estación (`resumen` y `lab.duracion` en
  `guiones/estaciones.js`). El botón **Estaciones** de la barra de arriba lo
  vuelve a abrir (antes era «↻ Reiniciar»), con la estación en curso marcada.
- **La URL lleva la estación** (`?estacion=N`): recargar vuelve a ella y no al
  menú, y sirve para compartir una sola mecánica. `start()` en `motor.js`
  arranca en `lab.inicio`, así que elegir una estación mientras el aula
  todavía carga también funciona.
- **Ventanas diminutas en Safari.** La ventana mide su alto por el contenido
  (`height: fit-content`), y su cuerpo tenía `flex:1`, que es base 0%. Safari
  17 y anteriores contaban el cuerpo con esa base de 0: la ventana quedaba de
  encabezado + pie, con el cuerpo aplastado en su relleno, y no se podía
  usar. Ahora `.vent-cuerpo` usa `flex:1 1 auto`. Se reprodujo y se probó con
  el WebKit 17.4 de Playwright. **El prototipo de Montaje tiene el mismo CSS.**
- **Ventanas que no se abrían.** Cada mecánica espera a que la cámara llegue
  al tablero antes de abrir su ventana. `tweenCamera` (en `js/escena.js`)
  guarda un solo movimiento a la vez, y si otro lo reemplazaba antes de
  terminar, el primero nunca avisaba. Un resize en esos ~850 ms (la barra del
  navegador en el celular, el teclado, girar la pantalla, el zoom) dejaba la
  mecánica activa, sin ventana y sin poder avanzar. Ahora el movimiento
  reemplazado se da por terminado. **El mismo error está en Montaje**
  (`apps/expedicion/js/escena.js`, que usan el prototipo y la expedición).
- Las ventanas miden su alto con `100dvh` y no con `100vh`: en el celular,
  `100vh` cuenta la barra del navegador y el pie con los botones quedaba
  tapado.

## Traer cambios del prototipo

Si el prototipo o la expedición cambian en Montaje, copiar encima y volver a
aplicar lo de arriba. Los archivos del laboratorio (`js/lab.js`,
`js/motor.js`, `js/partida.js`, `js/arranque.js`, `guiones/estaciones.js`,
`js/mecanicas/ficha.js`, `index.html`, `css/laboratorio.css`) tienen cambios
propios, y `js/escena.js` tiene el arreglo de `tweenCamera`; el resto
(`js/aula.js`, `elenco.js`, `historial.js`,
`imagenes.js`, `navegacion.js`, `main.js`, `character/`, `css/` de la
expedición) va tal cual.

## Qué observar en una prueba con docentes

1. ¿Entienden **qué hacer** con solo leer el encabezado de la ventana?
2. ¿Sienten que **lo que hacen cambia algo**? (la guía reescrita, los
   pupitres, la ficha con sus palabras)
3. ¿Se hace **largo**? Tiempo esperado: unos 15 minutos las seis estaciones.
4. ¿Pueden decir con sus palabras **qué aprendieron** en cada estación?
5. Ráfagas contra clásico: ¿notan la diferencia de ritmo?

## Límites conocidos

- Pensado para computador. En celular funciona, pero la imagen de las
  estaciones 1 y 3 queda pequeña.
- El progreso dentro de una estación no se guarda.
- Las reacciones del grupo (estaciones 2 y 5) son un modelo simple.

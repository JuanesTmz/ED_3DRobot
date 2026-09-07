# ED 3D Robot

Robot low-poly riggeado y animado (K-7), con un visor web hecho en three.js.

## Contenido

```
docs/
  index.html            visor: 3 modelos, 3 paletas, 6 poses
  charla.html           la escena de conversacion con K-7
  character/            K-7 empaquetado para reutilizarse en otro proyecto:
                         assets (robot/bocas/ojos.glb, paleta.js) + el
                         modulo k7.js que index.html y charla.html comparten.
                         Ver docs/character/README.md.
  implementos.glb       mesa, silla y tablero del fondo de la charla
  robot_rigged.glb      solo el Modelo1; es la fuente del rig
  vendor/three/         three.js 0.169 (sin CDN)

rig_cubehead.py         riggea el CubeHead y genera docs/character/robot.glb
build_bocas.py          quita la sonrisa soldada y genera docs/character/bocas.glb
build_modelo3.py        agrega el Modelo3 (cubo girado) a docs/character/robot.glb
build_ojos.py           quita los ojos soldados y genera docs/character/ojos.glb
build_implementos.py    prepara los muebles y genera docs/implementos.glb
robot_cubehead_solo.blend   piezas del Modelo2, sin rig
ImplementosFondo.blend      mesa, silla y tablero en bruto
referencias/                fuentes .blend de bocas, ojos y poses (sin comprometer)
```

Ver `docs/character/README.md` para el manual de K-7: manifiesto de assets,
convención de huesos, tabla de gestos, formato de paleta, y cómo montarlo en
un proyecto three.js nuevo.

## El fondo de la charla

`charla.html` decora el fondo con tres muebles sacados de
`ImplementosFondo.blend`. `build_implementos.py` los junta en tres mallas
(`Mesa`, `Silla`, `Tablero`), las normaliza a la escala de K-7 y les hornea el
acabado de boceto: relleno blanco hueso y contorno oscuro por cascara
invertida, la misma tecnica que usa el personaje.

```bash
blender -b ImplementosFondo.blend -P build_implementos.py
```

El reparto se recalcula en cada encuadre (`repartirProps`): en movil el
encuadre deja ver unas 3 unidades de ancho y en escritorio mas del doble, asi
que con posiciones fijas los muebles o se salen de cuadro o se amontonan.

## Boca y ojos intercambiables

El personaje traía la sonrisa y los ojos incrustados en la malla, soldados
al hueso `head` con peso rígido, así que no podía cambiar de gesto.
`build_bocas.py` y `build_ojos.py` se los quitan a los tres modelos -relleno
y cáscara de contorno, que si se queda deja el gesto viejo dibujado en
hueco- y exportan las mallas sueltas a `docs/character/bocas.glb` y
`docs/character/ojos.glb`. Se cuelgan del mismo hueso `head` en tiempo de
ejecución (no forman parte del skin), así que siguen a la cabeza sin
animarse con ella.

```bash
blender -b -P build_bocas.py
blender -b -P build_modelo3.py
blender -b -P build_ojos.py
```

Toda la lógica de qué boca/ojos van con cada modelo y cada gesto vive en
`docs/character/k7.js`, compartida por `index.html` y `charla.html`. Ver
`docs/character/README.md` para el detalle completo.

## Los tres modelos

`robot.glb` lleva las tres mallas (`Modelo1`, `Modelo2`, `Modelo3`)
skinneadas al **mismo** armature, con las mismas 6 animaciones. Comparten
rig y animación: cambiar de modelo en el visor solo alterna la visibilidad
de una malla u otra, sin recargar nada y sin reiniciar la animación.

El CubeHead (`Modelo2`) se pudo enganchar al rig original porque usa las
mismas proporciones y la misma convención de nombres por pieza
(`arm_upper_L`, `coat_flap_R`, …), así que cada pieza se asigna a su hueso
por prefijo. `Modelo3` es el mismo CubeHead con la cabeza girada sobre una
esquina (`build_modelo3.py`).

## Regenerar el modelo

```bash
blender -b robot_cubehead_solo.blend -P rig_cubehead.py
```

Lee `docs/robot_rigged.glb` para sacar el esqueleto y la animación, y escribe
`docs/character/robot.glb`.

## Ver en local

```bash
cd docs
python -m http.server 8000
```

Y abrir <http://localhost:8000>. Hace falta un servidor: los módulos ES y la
carga del `.glb` no funcionan abriendo el archivo con `file://`.

## Publicar en GitHub Pages

En *Settings → Pages*:

- **Source**: Deploy from a branch
- **Branch**: `main`, carpeta `/docs`

Guardar y esperar un par de minutos.

## Controles del visor

Arrastrar para orbitar, rueda para zoom. Los botones de abajo pausan la
animación, paran el giro automático, muestran el esqueleto y reencuadran la
cámara. La fila de arriba de esos botones cambia de pose (Reposo, Pensando,
Saltito, Triste, HighFive, Caminando).

Arriba a la derecha se cambia entre los 3 modelos y las 3 paletas. La
cámara no se mueve al cambiar de modelo y la animación sigue corriendo: es
el mismo rig.

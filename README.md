# ED 3D Robot

Robot low-poly riggeado y animado, con un visor web hecho en three.js.

## Contenido

```
docs/
  index.html            visor
  charla.html           la escena de conversacion con K-7
  robot.glb             lo que carga el visor: 1 armature + 2 mallas + Idle
  robot_rigged.glb      solo el modelo 1; es la fuente del rig
  implementos.glb       mesa, silla y tablero del fondo de la charla
  vendor/three/         three.js 0.169 (sin CDN)

rig_cubehead.py         riggea el CubeHead y genera docs/robot.glb
build_implementos.py    prepara los muebles y genera docs/implementos.glb
robot_cubehead_solo.blend   piezas del modelo 2, sin rig
ImplementosFondo.blend      mesa, silla y tablero en bruto
```

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

## Los dos modelos

`robot.glb` lleva las dos mallas (`Modelo1` y `Modelo2`) skinneadas al **mismo**
armature, con una sola acción `Idle`. Comparten rig y animación: cambiar de
modelo en el visor solo alterna la visibilidad de una malla u otra, sin recargar
nada y sin reiniciar la animación.

El CubeHead se pudo enganchar al rig original porque usa las mismas
proporciones y la misma convención de nombres por pieza (`arm_upper_L`,
`coat_flap_R`, …), así que cada pieza se asigna a su hueso por prefijo.

## Regenerar el modelo

```bash
blender -b robot_cubehead_solo.blend -P rig_cubehead.py
```

Lee `docs/robot_rigged.glb` para sacar el esqueleto y la animación, y escribe
`docs/robot.glb`.

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
cámara.

Arriba a la derecha se cambia entre *Modelo 1* y *Modelo 2*. La cámara no se
mueve al cambiar y la animación sigue corriendo: es el mismo rig.

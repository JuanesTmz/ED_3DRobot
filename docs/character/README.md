# K-7 — personaje reutilizable

Todo lo necesario para montar a K-7 en cualquier escena three.js: los tres
modelos, sus 6 poses, las bocas y ojos intercambiables, y 3 paletas de color.
Pensado para copiarse tal cual a otro proyecto.

```
character/
  k7.js        el modulo: clase K7 + las tablas de gestos/posiciones
  paleta.js    sistema de paletas por rol de material (independiente de K7)
  robot.glb    3 modelos + armature compartido + 6 animaciones
  bocas.glb    5 bocas sueltas (feliz, abierta, pensando, sorpresa, triste)
  ojos.glb     5 pares de ojos sueltos (normal, triste, guino, doble_guino, pensando)
```

## Uso mínimo

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { K7 } from './character/k7.js';

const scene = new THREE.Scene();

const k7 = new K7({ THREE, GLTFLoader, base: './character' });
await k7.cargar();
k7.agregarA(scene);

renderer.setAnimationLoop(() => {
  k7.actualizar(clock.getDelta());   // mixer + (si aplica) lipsync/cabeceo
  renderer.render(scene, camera);
});
```

Eso ya deja a K-7 de pie (Modelo 1, paleta 1, animación Idle, boca y ojos
normales). A partir de ahí:

```js
k7.mostrarModelo('Modelo2');            // 'Modelo1' | 'Modelo2' | 'Modelo3'
k7.aplicarPaletaPersonaje('dos');       // 'uno' | 'dos' | 'tres'
k7.reproducir('K7_Triste');             // ver tabla de gestos mas abajo
k7.hablar(true);                        // prende el lipsync + cabeceo; false lo apaga
k7.bocaEnReposo = 'pensando';           // boca a la que vuelve cuando hablar(false)
```

`index.html` (el visor, con las 6 poses) y `charla.html` (la conversación,
que solo usa `hablar()`) son los dos ejemplos reales de integración en este
mismo repo — ante la duda de cómo cablear algo, mirar ahí.

## Los tres modelos

`robot.glb` trae `Modelo1`, `Modelo2` y `Modelo3` skinneados al **mismo**
armature, con las **mismas 6 animaciones** (`Idle`, `K7_Pensando`,
`K7_Saltito`, `K7_Triste`, `K7_HighFive`, `K7_Caminando`). Cambiar de modelo
es alternar visibilidad; el rig y las animaciones no se reinician.

Cada modelo tiene la cabeza a distinta altura y anchura, así que la boca y
los ojos (ver más abajo) necesitan una posición/escala por modelo — de eso
se encargan `BOCA_DE_MODELO` y `OJOS_DE_MODELO` en `k7.js`.

## Boca y ojos: mallas sueltas colgadas del hueso `head`

Los tres modelos vinieron originalmente con la sonrisa y los ojos
**soldados** a la malla. `build_bocas.py` y `build_ojos.py` (raíz del repo)
se los quitaron y los dejaron como mallas sueltas sin skin, colgadas del
hueso `head` — así siguen a la cabeza sin animarse con ella, y cambiar de
gesto es solo alternar qué malla está visible.

- `bocas.glb`: `feliz`, `abierta`, `pensando`, `sorpresa`, `triste`
- `ojos.glb`: `normal`, `triste`, `guino`, `doble_guino`, `pensando`

Todas las mallas de un mismo set (boca u ojos) están normalizadas al mismo
criterio de origen/escala, así que se les puede aplicar la misma
posición/escala sin distinción.

## Tabla de gestos (`GESTO_DE_ANIM`)

Qué boca y qué ojos le corresponden a cada animación cuando se llama a
`k7.reproducir(nombre)` (usado por `index.html`, que muestra las 6 poses):

| Animación      | Boca       | Ojos          |
|----------------|------------|---------------|
| `Idle`         | feliz      | normal        |
| `K7_Caminando` | feliz      | normal        |
| `K7_HighFive`  | feliz      | guiño         |
| `K7_Saltito`   | feliz      | doble guiño   |
| `K7_Triste`    | triste     | triste        |
| `K7_Pensando`  | pensando   | pensando      |

`K7_Saltito` y `K7_HighFive` son gestos de una vez: `reproducir()` los deja
volver solos a `Idle` al terminar (ver `UNA_VEZ` en `k7.js`), y eso también
dispara `onAnimCambio` para que la app resincronice sus propios botones.

Una escena de conversación (como `charla.html`) normalmente no usa esta
tabla: en vez de cambiar de animación, llama a `k7.hablar(true/false)` y
deja que `k7.bocaEnReposo` decida la boca de fondo (`'feliz'` o
`'pensando'`, según si K-7 está esperando una respuesta).

## Paletas (`paleta.js`)

Cada material del modelo cumple un **rol** (`M_magenta` → `base`,
`M_navy` → `oscuro`, etc. — ver `ROL_DE_MATERIAL`), y cada paleta define un
color RGB **lineal** por rol (más un 4.º valor opcional: cuánto de ese color
se emite, por defecto `0.2`). Así una misma paleta vale para cualquier
modelo, y agregar una no toca los materiales, solo `paleta.js`.

Los tres modelos usan materiales con prefijos distintos (`M_` el original,
`QB_` el CubeHead) pero el mismo set de roles, así que **todas** las
paletas valen para **todos** los modelos.

Para sumar una paleta nueva: agregar una entrada a `PALETAS` con los 14
roles (ver las que ya existen), convirtiendo cada color de hex/sRGB a RGB
lineal (`c ≤ 0.04045 ? c/12.92 : ((c+0.055)/1.055)^2.4`, con `c` en 0–1).
Si un color muy saturado se ve apagado por la luz de la escena, subir su
4.º valor (emisión) en vez de tocar el color — así el dato sigue siendo la
conversión exacta del hex de origen.

## Regenerar los assets (pipeline de Blender)

Los `.glb` de esta carpeta salen de un pipeline de scripts de Blender que
vive en la raíz del repo (no aquí, porque no hace falta Blender para
*usar* al personaje, solo para *editar* su fuente). Orden de ejecución:

```bash
blender -b robot_cubehead_solo.blend -P rig_cubehead.py   # Modelo1 + Modelo2 + Idle
blender -b -P build_bocas.py                              # quita la sonrisa, exporta bocas.glb
blender -b -P build_modelo3.py                             # + Modelo3 (cubo girado)
blender -b -P build_ojos.py                                # quita los ojos, exporta ojos.glb
```

`build_bocas.py` y `build_ojos.py` se pueden re-ejecutar en cualquier orden
entre sí sin romper nada (cada uno detecta si ya no queda nada por quitar).
Las animaciones adicionales (`K7_Pensando`, `K7_Saltito`, `K7_Triste`,
`K7_HighFive`, `K7_Caminando`) se agregan directamente en Blender sobre el
resultado de `rig_cubehead.py`, antes de correr `build_bocas.py`.

# ED 3D Robot — low-poly riggeado para three.js

## Ver la web

```bash
cd web
python -m http.server 8000
```

Abrir <http://localhost:8000>. Hace falta servidor HTTP: los módulos ES y el
`fetch` del `.glb` no funcionan sobre `file://`. three.js está vendorizado en
`web/vendor/`, así que no hace falta conexión ni CDN.

## Despliegue

`.github/workflows/deploy.yml` publica la carpeta `web/` en GitHub Pages en cada
push a `main`. Requiere que en *Settings → Pages* la fuente esté puesta en
**GitHub Actions**.

## Archivos

| Archivo | Qué es |
|---|---|
| `build_character.py` | Genera la geometría. Paleta en `PALETTE`, cada pieza es un `box()`/`cyl()`. |
| `rig_and_export.py`  | Pipeline completo: optimiza, riggea, anima y exporta a `web/`. |
| `web/index.html`     | Visor three.js, un solo archivo. |
| `web/robot_rigged.glb` | El modelo final, riggeado y animado. |
| `web/vendor/three/`  | three.js 0.169 y sus addons, servidos desde el propio repo. |
| `robot_rigged.blend` | Escena de Blender con el rig, por si quieres editar. |

## Regenerar

```bash
BLENDER="/c/Program Files/Blender Foundation/Blender 4.4/blender.exe"
"$BLENDER" --background --python rig_and_export.py
```

`rig_and_export.py` importa `build_character.py`, así que para cambiar colores
o proporciones se edita el primero y se ejecuta el segundo.

## Optimización aplicada

| | Antes | Después |
|---|---|---|
| Objetos | 78 | 1 |
| Primitivas (≈ draw calls) | 154 | 14 |
| Triángulos | — | 2 824 |

Las 78 piezas se unen en una sola malla skinned. El límite ahora son los 14
materiales; bajar más exigiría un atlas de texturas y perder los colores planos.

## Rig

17 huesos: `root → hips → spine → chest → head`, más brazos
(`upperarm/forearm/hand`) y piernas (`thigh/shin/foot`) por lado.

**Skinning rígido**: cada pieza tiene un único vertex group con peso 1.0, sin
mezcla entre huesos. Da la misma deformación de bloques rígidos que el
bone-parenting, pero permite unir todo en una malla. Es lo correcto para un
personaje hard-surface: no hay geometría en codos ni rodillas que pueda doblarse,
así que cualquier peso repartido rompería las cajas.

El mapa pieza → hueso está en `BONE_OF_PREFIX` (`rig_and_export.py`), y se
evalúa en orden: los prefijos específicos van antes que los genéricos.

## Detalles que conviene conocer

- **El contorno** es una cáscara invertida (solidify con normales invertidas).
  Depende del *winding order*, no de una opción de material, por eso sobrevive
  al export a glTF: `M_outline` sale con `doubleSided: false` y three.js lo
  respeta sin código extra.
- **`frustumCulled = false`** en el visor: una malla skinned se deforma fuera de
  su bounding box original y three.js la haría desaparecer al orbitar.
- **Tone mapping `Neutral`**: ACESFilmic lava los colores planos de ilustración.
- **Las piezas espejadas** se generan con escala X negativa. El pipeline aplica
  las transformaciones y recalcula normales hacia fuera antes de riggear; si
  añades piezas nuevas con `mirror_x`, ese paso sigue siendo necesario.

## Animación

Un clip, `Idle`, de 2.5 s a 24 fps: respiración, rebote vertical y balanceo de
cabeza y brazos. Los fotogramas 0 y 60 son idénticos para que el bucle no salte.
Definida en `build_idle()` como una lista de pistas `(hueso, propiedad, eje,
valores)` — añadir movimiento es añadir una línea.

Para más clips: crear más acciones en Blender y marcarlas con *fake user*, o
usar el NLA. En three.js llegan como `gltf.animations[]`.

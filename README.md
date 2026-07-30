# ED 3D Robot

Robot low-poly riggeado y animado, con un visor web hecho en three.js.

## Contenido

```
docs/
  index.html          visor
  robot_rigged.glb    modelo riggeado + animación Idle
  vendor/three/       three.js 0.169 (sin CDN)
```

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

# ED 3D Robot

Robot low-poly riggeado y animado (K-7), con un visor web hecho en three.js.
El visor tambien monta a la Profesora, un segundo personaje intercambiable
(ver "La Profesora" mas abajo).

## Contenido

```
docs/
  index.html            visor: cambia entre K-7 y la Profesora; 3 modelos,
                         3 paletas y 6 poses para K-7; 5 gestos para la
                         Profesora
  charla.html            la escena de conversacion con K-7
  character/             K-7 y la Profesora empaquetados para reutilizarse en
                          otro proyecto: assets (robot/bocas/ojos.glb,
                          profesora.glb, paleta.js) + los modulos k7.js /
                          profesora.js que index.html comparte con charla.html.
                          Ver docs/character/README.md.
  implementos.glb        mesa, silla y tablero del fondo de la charla
  robot_rigged.glb       solo el Modelo1 de K-7; es la fuente del rig
  vendor/three/          three.js 0.169 (sin CDN)

rig_cubehead.py         riggea el CubeHead y genera docs/character/robot.glb
build_bocas.py          quita la sonrisa soldada y genera docs/character/bocas.glb
build_modelo3.py        agrega el Modelo3 (cubo girado) a docs/character/robot.glb
build_ojos.py           quita los ojos soldados y genera docs/character/ojos.glb
build_implementos.py    prepara los muebles y genera docs/implementos.glb
rig_profesora.py        riggea a la Profesora y genera docs/character/profesora.glb
robot_cubehead_solo.blend   piezas del Modelo2, sin rig
ImplementosFondo.blend      mesa, silla y tablero en bruto
referencias/                fuentes .blend de bocas, ojos, poses y de la
                             Profesora (sin comprometer)
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

## La Profesora

Segundo personaje del visor, modelado a mano en Blender. El .blend no trae
armature: modela el cuerpo entero 5 veces, una por pose, repartido en 5
colecciones por parte del cuerpo (`Piernas.00N`, `Torso.00N`, `Brazos.00N`,
`Cabeza.00N`, `Objetos.00N`). Las 5 poses, colocadas una al lado de la otra
a lo largo de X como un diorama, son:

| bucket | pose        | qué hace                                   |
|--------|-------------|--------------------------------------------|
| `.001` | reposo      | de pie, libreta contra el pecho (**bind**)  |
| `.002` | escribiendo | girada, escribiendo en la libreta           |
| `.003` | eureka      | lápiz en alto en la mano derecha            |
| `.004` | mirando     | de pie relajada, libreta bajo el brazo      |
| `.005` | caminando   | zancada                                     |

```bash
blender -b -P rig_profesora.py
```

Lee `referencias/Profe_live.blend` (una copia de la escena de trabajo; si no
existe cae a `Profe.blend`) y escribe `docs/character/profesora.glb`, más
`referencias/profesora_rigged.blend` para retocar a mano y una preview por
pose (`preview_profesora_*.png`, en la raíz) para revisar el resultado sin
abrir Blender.

### Las tres cosas que hay que hacer bien

**Normales.** 65 de las 200 piezas son espejos hechos con **escala X
negativa** (todo el lado `_R`, más `shoe_l`). Al unir las mallas, Blender
hornea esa escala y el winding de esas piezas queda invertido: la malla base
se ilumina al revés y el casco invertido del contorno, en vez de quedar
oculto por el backface culling, se dibuja **sólido encima**. Es lo que se veía
como "medio cuerpo negro". Se arregla aplicando rotación+escala y recalculando
normales hacia fuera **antes de hornear nada** — el mismo paso que
`rig_and_export.py` ya hacía para K-7.

**Contorno.** El solidify que traen las piezas usa grosor `0.0679` en espacio
**local**, sin compensar la escala del objeto: en piezas alargadas, y sobre
todo en el pelo (decenas de esferas de radio ~0.1), el contorno se infla
hasta comerse la pieza. Se rehace con grosor uniforme en mundo (`0.019`, como
K-7). Además el shell se manda al **último** slot de material —que se fuerza
a ser el outline— en vez de usar `material_offset` relativo, que en las piezas
de 3-4 slots lo mandaba a un material cualquiera, y esos no llevan backface
culling.

**Poses fieles.** El retarget no aproxima con rotaciones: a cada hueso se le
da la transformada **completa** de su pieza, descontando el desplazamiento
del diorama (medido con la cadera, para que la pose se reproduzca en el
sitio). Como el skinning es rígido (peso 1.0), eso reproduce la pose
exactamente como está modelada.

### Cuidado: los nombres de las piezas mienten sobre el lado

`shoe_R` está en **x = +0.135** (la izquierda del personaje) y `shoe_l` en
**x = −0.135** (la derecha): vienen cruzados. Mapearlos por el nombre ponía el
hueso del pie cruzando el cuerpo hasta el zapato del otro lado, y de ahí las
trayectorias imposibles al caminar. El mapeo va por **posición**, y
`comprobar_lados()` avisa en cada corrida si alguna pieza acaba en un hueso
del lado contrario. Los ojos y el cuello también tienen los nombres
cruzados, pero da igual: van a `head` y `chest`, que no tienen lado.

### Girar antes que trasladar

La matriz exacta lleva traslación propia, y esa traslación vive en el basis
local del hueso: se interpola en línea recta mientras el padre gira, así que
entre fotogramas el hueso se despega de su padre. Por eso cada hueso prueba
primero una versión que **solo gira**, dejando que la posición la ponga la
cadena, y solo usa la matriz exacta si girando se iría más de
`TOLERANCIA_FK`. Las piernas (`SOLO_GIRO`) nunca trasladan: girando se apartan
3–5 cm de la pose modelada, que a cambio de que los pies describan el arco de
la pierna es un cambio que vale la pena.

### Piezas con hueso propio, y piezas pegadas

Sobre el esqueleto anatómico, el script **detecta solo** qué piezas no siguen
fielmente a su hueso —porque el autor las recoloca aparte— y les da un hueso
propio colgado del anatómico (`p_<pieza>`). Hoy salen la manga izquierda (se
desviaba 31 cm) y los dedos de la mano izquierda. No hay que mantener esa
lista a mano: si en una pose nueva se mueve otra pieza por su cuenta, aparece
sola (ver `TOLERANCIA_PIEZA`).

Los accesorios son la excepción (`PEGADAS`): van clavados a su hueso y se
mueven con él. Medido sobre las 5 poses, el **lápiz** se queda a 2–6 cm de
`hand_L` y la **libreta** a 14–25 cm de `hand_R`, así que el agarre es
consistente; con hueso propio interpolaban por su cuenta y se despegaban de
la mano. La soga va en `hips`.

### El ciclo de caminata

Fabrica el apoyo contrario espejando en X **solo las piernas** (los brazos
sostienen libreta y lápiz, y espejarlos les suelta las manos de lo que
llevan) y le suma el vaivén de brazos que pide un walk cycle, girando cada
brazo desde el hombro con la cadena entera para que antebrazo, mano y lo que
lleve acompañen (`BALANCEO_BRAZOS`).

Al espejar hay que **descontar antes el desplazamiento del diorama**: son
~8,8 m en X para la caminata, van dentro del delta, y reflejarlos sin
quitarlos les cambia el signo y manda los miembros al otro lado del mapa.

### Los gestos se sostienen

Los cuatro gestos de Vero son **bucles**, no clips de una sola pasada: entran
por el crossfade de `reproducir()` (medio segundo, igual que los de K-7) y se
mantienen mientras dure el mensaje, hasta que el guion pida otra cosa. Al
principio los hice como «reposo → pose → reposo» y se caían a los dos
segundos, dejando a Vero en reposo el resto del mensaje.

Para que el bucle no parezca una foto, cada uno lleva algo de vida: en
`Escribiendo` la cadena de `hand_L` va y viene sobre la libreta
(`TRAZO_ESCRIBIR`), y en los demás una respiración mínima —el pecho se yergue
un grado y el cuerpo sube nueve milímetros—. Los fotogramas 0 y último son
idénticos para que el ciclo no salte.

Por eso `UNA_VEZ` está vacío en `profesora.js`: ninguno de sus gestos vuelve
solo al reposo. El mecanismo se queda montado por si alguno futuro lo
necesita, como `K7_Saltito` y `K7_HighFive` en K-7.

### La boca y los ojos

Igual que K-7, el modelo no trae boca dibujada: `docs/character/profesora.js`
cuelga la misma `docs/character/bocas.glb` del hueso `head` con su propia
constante `BOCA_PROFESORA`. No está puesta a ojo — el hueso `head` arranca en
`y=1.7223` y, midiendo la malla ya cargada, la cara va de `y=1.794` (barbilla)
a `2.207` (coronilla) con las gafas ocupando `1.972`–`2.128`; el borde de
arriba de la boca queda mejor arrimado a las gafas que centrado en ese hueco.

Los ojos venían en negro absoluto y quedaban más duros que todo lo demás. El
pipeline los pasa a `TINTA_BOCA`, el mismo color con que `build_bocas.py`
pinta `bocas.glb`, para que la cara case.

### Saturación

Al lado de K-7 —que va de magenta, lima y teal— su ropa se leía apagada: el
pantalón partía de una saturación de **0.12** y el salacot era casi un beige
gris. `SATURACION_OBJETIVO` le sube cada material hasta una saturación
**destino**, no por un factor: multiplicar no servía, porque por mucho que
multipliques un 0.12 sigue siendo un gris. K-7 vive entre 0.28 (su teal) y
0.63 (su amarillo), así que sus destinos se eligieron en ese rango —0.40 el
pantalón, 0.42 el salacot, 0.70 el lápiz— y más bajos donde no debe gritar
(0.30 el papel de la libreta, 0.22 el metal).

El ajuste se hace en **sRGB**, no en el lineal que guardan los materiales:
saturar directamente sobre el lineal aclara los colores en vez de avivarlos.
Y nunca baja la saturación de nada, solo la sube hasta el destino.

### Los colores que comparte con K-7

Vero viste sobria y así se queda: el pantalón, el salacot, la piel y el pelo
no se tocan. Lo que sí toma prestado de la paleta 1 de K-7 (ver
`COLORES_DE_K7`) son los acentos, para que los dos se lean del mismo mundo:
el amarillo del cuello, el azul de la camisa (`bata_d`), el teal del calzado
(`bata`) y el lima de la franja de los zapatos (`acento`). La sombra de la
camisa y las mangas van al mismo azul al 70%, para conservar la relación
claro/oscuro que traía el modelo.

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

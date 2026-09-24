/* Expedición Docente · El aula: los muebles del fondo (con el Tablero), la
 * decoración que deja cada expedición y los accesorios de K-7 del epílogo. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { scene, camera, TARGET, estrechez, k7, fail } from './escena.js';
import { partida, EXPEDICIONES } from './partida.js';

export let boardBox = null;       // Box3 del Tablero en espacio mundo (no se mueve)

/* ------------------------------------------------------ muebles del fondo */
/* Los tres implementos salen de ImplementosFondo.blend con acabado de boceto:
   relleno blanco hueso y contorno oscuro horneado en la malla. Se reparten
   detrás de K-7, y su separación se recalcula en cada encuadre: en móvil el
   encuadre deja ver unas 3 unidades de ancho y en escritorio más del doble,
   así que con posiciones fijas o se salen de cuadro o se amontonan. */

const props = new THREE.Group();
props.visible = false;
scene.add(props);

// x se multiplica por la separación que quepa en pantalla; el resto es fijo
const MUEBLES = [
  { pieza: 'Tablero', x:  0.00, y: 0.62, z: -3.10, rot:   0, fijo: true },
  { pieza: 'Mesa',    x: -1.32, y: 0,    z: -1.55, rot:  18 },
  { pieza: 'Silla',   x: -1.94, y: 0,    z: -2.18, rot:  18 },
  { pieza: 'Mesa',    x:  1.46, y: 0,    z: -1.20, rot: -22 },
  { pieza: 'Silla',   x:  2.10, y: 0,    z: -1.85, rot: -22 },
  { pieza: 'Mesa',    x: -2.95, y: 0,    z: -3.30, rot:  12 },
  { pieza: 'Silla',   x: -3.55, y: 0,    z: -3.85, rot:  12 },
];

const SEP_MIN = 0.66, SEP_MAX = 1.2;  // apaisado: manda `ancho/5.6` entre los dos
/* En vertical los dos extremos convergen a este valor, o sea que la separación
   queda fija. Tiene que ser así: si se dejara a `ancho/5.6`, al retroceder la
   cámara subiría sola y volvería a sacar de cuadro al telescopio y a la
   orquídea, que es justo lo que el retroceso venía a arreglar.
   Este valor y RETROCESO_ESTRECHO están calibrados juntos: con 1.18 y 0.44 el
   globo -en x=-2.26- entra entero y del telescopio -en x=2.50, el más lateral
   de todos- se ve bien la mitad. Separar más, o acercar la cámara, empuja al
   telescopio fuera; son las dos caras del mismo compromiso. */
const SEP_ESTRECHO = 0.44;

export function repartirProps() {
  if (!props.children.length) return;
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
  // ancho visible a la profundidad media de los muebles (~1.8 detrás de K-7)
  const dist = camera.position.distanceTo(TARGET) + 1.8;
  const ancho = 2 * dist * Math.tan(halfFov) * camera.aspect;
  /* En apaisado esto no cambia nada: `ancho/5.6` se queda en el tope de 1.2
     como siempre. En vertical los dos extremos valen lo mismo y la separación
     pasa a ser fija (ver SEP_ESTRECHO). */
  const t = estrechez();
  const sep = THREE.MathUtils.clamp(ancho / 5.6,
    THREE.MathUtils.lerp(SEP_MIN, SEP_ESTRECHO, t),
    THREE.MathUtils.lerp(SEP_MAX, SEP_ESTRECHO, t));
  for (const ob of props.children)
    ob.position.x = ob.userData.x * (ob.userData.fijo ? 1 : sep);
  props.visible = true;
}

/* --------------------------------------------------- decoración del aula */
/* El salón se va llenando: cada expedición deja algo. La Expedición 1 se juega
   con el aula pelada -solo mesas, sillas y tablero- y de ahí en adelante, al
   entrar a cada expedición, ya están puestas las de las anteriores. La
   distribución sale de referencia/escenario_decoracion.blend, que comparte el
   sistema de coordenadas del juego: cada pieza viene en el .glb ya ubicada
   donde va, sin números a mano aquí.

   Las cuatro que se apoyan en una mesa cuelgan de ella y no de la escena: las
   mesas se corren de lado según el ancho de la ventana (ver repartirProps()),
   así que una taza puesta en coordenadas absolutas quedaría flotando en el
   aire en pantallas angostas. Las del piso sí van sueltas, pero su x también
   se escala con el mismo factor, para que el conjunto no se desarme. */

// PRUEBA: en false, los adornos se ven sin su línea de contorno. La cáscara
// sigue viniendo en el .glb, solo se deja de dibujar, así que devolverla es
// cambiar esta palabra.
const CONTORNO_DECORACION = false;

const DECORACION_POR_FASE = [
  [],                                        // Exp 1 · el aula todavía vacía
  ['deco_suculenta', 'deco_libro_mesa2'],    // Exp 2 · ética
  ['deco_orquidea', 'deco_planta_suelo'],    // Exp 3 · fundamentos
  ['deco_telescopio', 'deco_libros_mesa1'],  // Exp 4 · pedagogía
  ['deco_bolso', 'deco_globo'],              // Exp 5 · aprendizaje profesional
  [],                                        // Epílogo
];
// decoración -> índice en MUEBLES de la mesa que la sostiene
const DECO_SOBRE_MESA = {
  deco_libros_mesa1: 1,   // Mesa de la izquierda
  deco_suculenta:    1,
  deco_libro_mesa2:  3,   // Mesa de la derecha
  deco_orquidea:     3,
};

const mueblesPuestos = [];        // clones de MUEBLES, en el mismo orden
const decoraciones = new Map();   // nombre -> objeto ya ubicado en la escena
let decoGltf = null;

function colocarDecoracion() {
  if (!decoGltf || !mueblesPuestos.length || decoraciones.size) return;
  // Altura de la tapa de cada mesa, medida ANTES de colgarles nada (después,
  // la caja envolvente incluiría a la propia decoración). Hace falta porque
  // las mesas de referencia del .blend miden 0.83 y las de implementos.glb
  // miden 1.05: sin corregir, los libros y la suculenta quedan un cuarto de
  // unidad hundidos dentro de la mesa.
  const tapaDeMesa = mueblesPuestos.map(
    (m) => new THREE.Box3().setFromObject(m).max.y);

  for (const hijo of [...decoGltf.scene.children]) {
    const mesaIdx = DECO_SOBRE_MESA[hijo.name];
    if (mesaIdx != null) {
      const mesa = mueblesPuestos[mesaIdx];
      // `attach` -y no `add`- porque las mesas están rotadas (18°, -22°):
      // restar la posición a secas dejaría al objeto girando con la mesa y
      // aterrizando fuera de ella. Y se hace con la mesa en su x de origen,
      // que es para la que se dibujó la escena en Blender; repartirProps()
      // ya la habrá corrido, así que se devuelve un momento y se restituye.
      // apoyarla sobre la tapa real antes de colgarla
      const base = new THREE.Box3().setFromObject(hijo).min.y;
      hijo.position.y += tapaDeMesa[mesaIdx] - base;

      const xCorrida = mesa.position.x;
      mesa.position.x = mesa.userData.x;
      mesa.updateMatrixWorld(true);
      mesa.attach(hijo);
      mesa.position.x = xCorrida;
      mesa.updateMatrixWorld(true);
    } else {
      hijo.userData = { x: hijo.position.x };   // que repartirProps la escale
      props.add(hijo);
    }
    hijo.visible = false;
    decoraciones.set(hijo.name, hijo);
  }
  sincronizarDecoracion(partida.expActualIdx, false);
}

// Deja visibles las decoraciones que corresponden a la fase `idx` (las suyas y
// las de todas las anteriores). Con `animar`, las que entran nuevas crecen
// hasta su tamaño en vez de aparecer de golpe.
export function sincronizarDecoracion(idx, animar) {
  // En el epílogo K-7 se lleva puesto el bolso y la banda. Las insignias no:
  // esas se encienden de a una mientras él va nombrando cada ámbito
  // (ver mostrarInsignia), que es lo que hace que la banda se vea llenarse.
  const esEpilogo = idx >= EXPEDICIONES.length;
  for (const acc of accesoriosK7) acc.visible = esEpilogo;

  if (!decoraciones.size) return;
  const tocan = new Set();
  for (let i = 0; i <= idx && i < DECORACION_POR_FASE.length; i++)
    for (const n of DECORACION_POR_FASE[i]) tocan.add(n);
  // ese bolso es el mismo: si lo lleva encima, no puede seguir en el piso
  if (esEpilogo) tocan.delete('deco_bolso');
  for (const [nombre, ob] of decoraciones) {
    const debeVerse = tocan.has(nombre);
    if (debeVerse && !ob.visible) {
      ob.visible = true;
      if (animar) crecerDecoracion(ob);
    } else if (!debeVerse && ob.visible) {
      ob.visible = false;
    }
  }
}

// Entra asentándose, con un rebote corto: se nota sin distraer de la charla.
// Multiplica la escala propia del objeto en vez de reemplazarla: las insignias
// de la banda vienen achatadas del .blend (0.064, 0.01, 0.064), y un
// setScalar() las devolvía a 1 -o sea, discos de dos metros tapando la escena.
function escalaBaseDe(ob) {
  if (!ob.userData.escalaBase) ob.userData.escalaBase = ob.scale.clone();
  return ob.userData.escalaBase;
}

function crecerDecoracion(ob) {
  const base = escalaBaseDe(ob);
  const t0 = performance.now();
  const DUR = 460;
  const paso = () => {
    const t = Math.min(1, (performance.now() - t0) / DUR);
    // rebote suave: pasa de largo un poco y vuelve
    const e = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
    const s = t >= 1 ? 1 : e * (1 + 0.12 * Math.sin(Math.PI * t));
    ob.scale.copy(base).multiplyScalar(s);
    if (t < 1) requestAnimationFrame(paso);
    else ob.scale.copy(base);
  };
  ob.scale.copy(base).multiplyScalar(0.01);
  paso();
}

/* ------------------------------------------ accesorios del epílogo --- */
/* En el epílogo K-7 sale con el bolso a la espalda y la banda scout con las
   cinco insignias, una por expedición. Vienen de referencia/k7-accesorios.blend
   colocados sobre el personaje en pose de reposo, y aquí se cuelgan del hueso
   `chest` para que lo acompañen cuando camina, salta o piensa -es el mismo
   mecanismo con el que k7.js le monta la cara al hueso `head`.

   La cuenta usa la matriz de bind del hueso, no su posición actual: K-7 nunca
   está quieto (la animación Idle siempre corre), así que engancharlos contra
   la pose del momento les dejaría clavada esa desviación. */
export const accesoriosK7 = [];
export let accGltf = null;

export function montarAccesoriosK7(gltf) {
  const hueso = k7.hPecho;
  if (!hueso || !k7.model || accesoriosK7.length) return;
  let piel = null;
  k7.model.traverse((o) => { if (!piel && o.isSkinnedMesh) piel = o; });
  if (!piel) return;
  const i = piel.skeleton.bones.indexOf(hueso);
  if (i < 0) { fail('el hueso chest no está en el esqueleto de K-7'); return; }
  const bindInverso = piel.skeleton.boneInverses[i];

  for (const hijo of [...gltf.scene.children]) {
    hijo.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;   // van pegados al cuerpo: su sombra es la de él
      o.receiveShadow = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (/outline/i.test(m.name)) {
          m.side = THREE.FrontSide;
          m.polygonOffset = true;
          m.polygonOffsetFactor = 1;
        }
      }
    });
    hijo.applyMatrix4(bindInverso);   // de pose de reposo a local del hueso
    escalaBaseDe(hijo);   // guardar su escala real antes de que nada la anime
    hijo.visible = false;
    hueso.add(hijo);
    accesoriosK7.push(hijo);
  }
  sincronizarDecoracion(partida.expActualIdx, false);
}

/* Los tres .glb del aula se piden al arrancar (ver main.js) y cada uno se
   engancha cuando llega: ninguno frena el arranque de la charla. */
export function cargarAula() {
  // el fondo se carga aparte y no bloquea el arranque de la charla
  new GLTFLoader().load('implementos.glb', (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      // no reciben sombra: están detrás de K-7 y nada les cae encima, así que
      // el muestreo PCF en sus 14 mallas no compraba nada
      o.receiveShadow = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        // misma cáscara invertida que en el robot: solo se ve por delante
        if (/outline/i.test(m.name)) {
          m.side = THREE.FrontSide;
          m.polygonOffset = true;
          m.polygonOffsetFactor = 1;
        }
      }
    });

    for (const m of MUEBLES) {
      const base = gltf.scene.getObjectByName(m.pieza);
      if (!base) { fail('falta ' + m.pieza + ' en implementos.glb'); continue; }
      const ob = base.clone();       // el clon comparte geometría y material
      ob.position.set(m.x, m.y, m.z);
      ob.rotation.set(0, THREE.MathUtils.degToRad(m.rot), 0);
      ob.userData = { x: m.x, fijo: !!m.fijo };
      props.add(ob);
      mueblesPuestos.push(ob);       // las decoraciones de mesa cuelgan de estos
      // el Tablero es 'fijo' (su x no depende del ancho de pantalla): su caja
      // en espacio mundo no vuelve a cambiar, se puede medir una sola vez aquí
      if (m.pieza === 'Tablero') boardBox = new THREE.Box3().setFromObject(ob);
    }
    repartirProps();
    colocarDecoracion();   // si el .glb de decoración ya llegó, engancharla
  }, undefined, (e) => fail('implementos.glb: ' + e.message));

  new GLTFLoader().load('accesorios-k7.glb', (gltf) => {
    accGltf = gltf;
    montarAccesoriosK7(gltf);
  }, undefined, (e) => fail('accesorios-k7.glb: ' + e.message));

  // pesa más que el resto del fondo y no hace falta hasta terminar la Expedición
  // 1, así que no compite con el arranque: se pide y se engancha cuando llegue
  new GLTFLoader().load('decoraciones.glb', (gltf) => {
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.receiveShadow = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      let esContorno = false;
      for (const m of mats) {
        // mismo trato que los muebles: la cáscara del contorno se ve solo por delante
        if (/outline/i.test(m.name)) {
          esContorno = true;
          m.side = THREE.FrontSide;
          m.polygonOffset = true;
          m.polygonOffsetFactor = 1;
        }
      }
      // la cáscara envuelve a su relleno: su sombra es la misma, apenas un pelo
      // más grande. Dejarla fuera del pase de sombras ahorra dibujarla dos veces
      // por fotograma sin que se note nada.
      o.castShadow = !esContorno;
      if (esContorno && !CONTORNO_DECORACION) o.visible = false;
    });
    decoGltf = gltf;
    colocarDecoracion();
  }, undefined, (e) => fail('decoraciones.glb: ' + e.message));
}

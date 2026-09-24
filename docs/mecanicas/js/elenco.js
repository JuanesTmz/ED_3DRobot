/* Expedición Docente · El elenco en escena: el encuadre de la cámara sobre K-7
 * (y Vero, cuando está), la entrada de Vero, y los gestos de K-7 que el guion
 * pide (saltitos, mostrar la mochila). */
import * as THREE from 'three';
import {
  scene, camera, TARGET, FOV_K7, VIEW_DIR, RETROCESO, retrocesoPorAspecto,
  k7, profesora, vista, tweenCamera, tweenProp, esperar,
} from './escena.js';
import { repartirProps } from './aula.js';

// marcas de suelo. K-7 esta solo en el centro hasta que llega Vero; ahi se
// corre a la izquierda para hacerle sitio.
const K7_X_SOLO = 0;
const K7_X_DUO = -0.62;
const VERO_X = 0.80;
const VERO_X_FUERA = 3.6;      // fuera de cuadro por la derecha
const ENTRADA_MS = 3400;
// cuando ella llega, K-7 deja de mirar de frente y se gira hacia su lado: los
// dos quedan conversando en vez de ser dos figuras mirando al docente
const K7_GIRO_DUO = 24;        // grados

export let veroEnEscena = false;      // ya entro (y por tanto el encuadre es de dos)
let k7BaseX = K7_X_SOLO;       // x "de reposo" de K-7, la que respetan los saltitos

const CENTER = new THREE.Vector3();   // centro real del modelo
let modelRadius = 1;

// El personaje tiene que caber en el hueco libre entre la barra de arriba
// (avatares) y la caja de dialogo de abajo, centrado en ese hueco -no en la
// pantalla entera-. Antes se aproximaba con una fraccion fija de la pantalla
// (0.52/0.62 segun el alto) pensada de escritorio: en movil, angosto, la
// barra de arriba se parte en dos lineas y la caja mide menos, asi que esa
// fraccion se quedaba corta y el personaje quedaba con la cabeza pegada a
// los botones. Mide los dos huecos de verdad en vez de adivinarlos.
/* Centro y radio de lo que la cámara tiene que encuadrar: K-7 solo, o K-7 y
   Vero juntos una vez ella entra. Vero se mide SIEMPRE en su marca final, no
   donde esté en ese instante: durante la entrada viene desde fuera de cuadro
   y el encuadre saldría absurdamente abierto. */
function medirElenco() {
  if (!k7.model) return;
  const box = new THREE.Box3().setFromObject(k7.model);

  if (veroEnEscena && profesora.model) {
    const x = profesora.model.position.x;
    const ry = profesora.model.rotation.y;
    profesora.model.position.x = VERO_X;
    profesora.model.rotation.y = 0;
    profesora.model.updateMatrixWorld(true);
    box.expandByObject(profesora.model);
    profesora.model.position.x = x;
    profesora.model.rotation.y = ry;
    profesora.model.updateMatrixWorld(true);
  }

  box.getCenter(CENTER);
  const size = box.getSize(new THREE.Vector3());
  modelRadius = Math.max(size.x, size.y, size.z) * 0.5;
}

export function frame() {
  medirElenco();
  // si la cámara está mirando al tablero (ver pizarra más abajo), esta llamada
  // solo debe refrescar vista.camPoseK7 para cuando se vuelva; no debe mover la
  // cámara que el docente tiene delante en ese momento
  const posarDespues = vista.inBoardView ? { pos: camera.position.clone(), target: TARGET.clone(), fov: camera.fov } : null;

  // el tablero (ver poseTablero) puede dejar el fov ensanchado: esta es la
  // pose "normal" frente a K-7, siempre con el fov base, sin importar cual
  // estuviera activo al llamar a frame() (p.ej. si se redimensiona la
  // ventana mientras se mira el tablero)
  camera.fov = FOV_K7;
  camera.updateProjectionMatrix();

  const arribaLibre = document.getElementById('topbar').getBoundingClientRect().bottom;
  const abajoLibre = document.getElementById('hud').getBoundingClientRect().top;
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);

  const zoom = THREE.MathUtils.clamp((abajoLibre - arribaLibre) / innerHeight, 0.42, 0.68);
  const dist = modelRadius / Math.sin(halfFov) / zoom * RETROCESO * retrocesoPorAspecto();
  const visibleH = 2 * dist * Math.tan(halfFov);

  const centroHueco = (arribaLibre + abajoLibre) / 2;
  const bajar = (innerHeight / 2 - centroHueco) * (visibleH / innerHeight);

  TARGET.copy(CENTER);
  TARGET.y -= bajar;
  camera.position.copy(VIEW_DIR).multiplyScalar(dist).add(TARGET);
  camera.lookAt(TARGET);
  vista.camPoseK7 = { pos: camera.position.clone(), target: TARGET.clone(), fov: FOV_K7 };

  if (posarDespues) {
    camera.position.copy(posarDespues.pos);
    TARGET.copy(posarDespues.target);
    camera.fov = posarDespues.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(TARGET);
  }
  repartirProps();
}

export function cargarProfesora() {
  /* Vero se carga en segundo plano, como los muebles: no aparece hasta 1.5, así
     que no tiene por qué retrasar el arranque de la charla. */
  profesora.cargar().then(() => {
    if (!profesora.model) return;
    profesora.agregarA(scene);
    profesora.aplicarPaletaCara(k7.paleta);   // la misma que tenga K-7
    profesora.model.visible = false;
    profesora.model.position.set(VERO_X_FUERA, 0, 0);
  });
}

/* ------------------------------------------------- la entrada de Vero --- */
/* K-7 la anuncia («¡Buen día, profe Vero!») y ella entra caminando por la
   derecha. Mientras cruza: camina de perfil hacia donde va, K-7 se corre a la
   izquierda para hacerle sitio y la cámara se abre del encuadre de uno al de
   dos. Al llegar a su marca se gira hacia el docente y se queda en reposo. */
export async function entrarProfesora() {
  if (veroEnEscena || !profesora.model) return;
  veroEnEscena = true;

  profesora.model.visible = true;
  profesora.model.position.set(VERO_X_FUERA, 0, 0);
  profesora.model.rotation.y = -Math.PI / 2;   // de perfil, mirando a -X
  profesora.reproducir('Profesora_Caminando', 0.2);

  // K-7 le hace sitio y ademas se gira hacia ella
  k7BaseX = K7_X_DUO;
  tweenProp(k7.model.position, 'x', K7_X_DUO, ENTRADA_MS * 0.75);
  tweenProp(k7.model.rotation, 'y', THREE.MathUtils.degToRad(K7_GIRO_DUO), ENTRADA_MS * 0.75);
  abrirEncuadre(ENTRADA_MS * 0.8);

  await tweenProp(profesora.model.position, 'x', VERO_X, ENTRADA_MS);
  await tweenProp(profesora.model.rotation, 'y', 0, 420);
  profesora.reproducir('Profesora_Idle', 0.35);
}

/* El saltito con el que muestra la mochila: pega el brinco, se da la vuelta
   y SE QUEDA de espaldas. No vuelve solo a los dos segundos: se queda así todo
   lo que el docente tarde en leer, y se gira recién cuando pasa el mensaje
   (ver guardarMochila() en advance()). */
let mochilaAlHombro = false;

export async function mostrarMochila() {
  if (!k7.model) return;
  k7.reproducir('K7_Saltito');
  await esperar(320);
  await tweenProp(k7.model.rotation, 'y', Math.PI, 650);
  mochilaAlHombro = true;
}

export function guardarMochila() {
  if (!mochilaAlHombro || !k7.model) return;
  mochilaAlHombro = false;
  // con Vero en escena él no mira de frente sino ladeado hacia ella: hay que
  // devolverlo a ESE ángulo, no a cero
  const dondeMiraba = veroEnEscena ? THREE.MathUtils.degToRad(K7_GIRO_DUO) : 0;
  tweenProp(k7.model.rotation, 'y', dondeMiraba, 650);
  k7.reproducir('Idle', 0.35);
}

/* La pone en escena sin entrada: ya plantada en su marca, con K-7 corrido y el
   encuadre a dos hecho. Es lo contrario de quitarProfesora() y, como ella, se
   llama detrás de la tarjeta de capítulo, que tapa el corte. Lo usa el epílogo
   (`conVero` en su nodo de capítulo): allí Vero no llega, ya estaba. */
export function ponerProfesora() {
  if (veroEnEscena || !profesora.model) return;
  veroEnEscena = true;
  profesora.model.visible = true;
  profesora.model.position.set(VERO_X, 0, 0);
  profesora.model.rotation.y = 0;
  profesora.reproducir('Profesora_Idle', 0);

  k7BaseX = K7_X_DUO;
  k7.model.position.x = K7_X_DUO;
  k7.model.rotation.y = THREE.MathUtils.degToRad(K7_GIRO_DUO);
  frame();
}

/* Vero se queda en escena hasta el final de la expedición: no se despide
   andando. Quien la retira es el cambio de expedición, y lo hace en seco —la
   tarjeta de capítulo ocupa toda la pantalla, así que el corte no se ve—.
   Vuelve a entrar más adelante, en el punto del guion que lo pida (otro nodo
   con `entra: true`), nunca desde el arranque de una expedición. */
export function quitarProfesora() {
  if (!veroEnEscena || !profesora.model) return;
  profesora.model.visible = false;
  profesora.hablar(false);
  veroEnEscena = false;          // antes de reencuadrar: ya no cuenta en medirElenco

  k7BaseX = K7_X_SOLO;
  k7.model.position.x = K7_X_SOLO;
  k7.model.rotation.y = 0;       // vuelve a mirar de frente al docente
  frame();                       // reencuadre en seco, detrás de la tarjeta
}

/* Lleva la cámara del encuadre actual al que toca ahora (frame() ya sabe si
   el elenco es de uno o de dos), pero animada en vez de en seco. */
let duoPose = null;   // encuadre "a dos" (K-7 + Vero): se fija la primera vez y se reusa siempre
function abrirEncuadre(dur) {
  const desde = { pos: camera.position.clone(), target: TARGET.clone(), fov: camera.fov };
  frame();
  const hasta = { pos: camera.position.clone(), target: TARGET.clone(), fov: camera.fov };
  // sin esto, cada entrada de Vero podía recalcular un encuadre ligeramente
  // distinto (aspect/tiempos de medición) y la cámara se veía "irse atrás"
  // en expediciones posteriores a la primera
  if (veroEnEscena) {
    if (!duoPose) duoPose = hasta;
    else { hasta.pos.copy(duoPose.pos); hasta.target.copy(duoPose.target); hasta.fov = duoPose.fov; }
  }
  camera.position.copy(desde.pos);
  TARGET.copy(desde.target);
  camera.fov = desde.fov;
  camera.updateProjectionMatrix();
  tweenCamera(hasta, dur);
}

// una expedición nueva arranca con K-7 de frente, sin el bolso al hombro
// (ver la tarjeta de capítulo en next())
export function reiniciarMochila() {
  mochilaAlHombro = false;
}

/* dos saltitos seguidos, uno ladeado a cada lado: reutiliza la animación
   K7_Saltito tal cual (no hay clip mirrado) y le monta encima un pequeño
   desplazamiento lateral en X, a la izquierda la primera vez y a la derecha
   la segunda -como el cabeceo de hablar(), pero puntual y no cada fotograma */
function saltoLadeado(signo) {
  return new Promise((resolve) => {
    k7.reproducir('K7_Saltito');
    const clip = k7.actions['K7_Saltito']?.getClip();
    const dur = (clip ? clip.duration : 0.6) * 1000;
    const t0 = performance.now();
    const desplazar = signo * 0.16;
    (function step() {
      const t = Math.min(1, (performance.now() - t0) / dur);
      // el saltito se suma a donde esté K-7, que no siempre es el centro:
      // cuando llega Vero se corre a la izquierda (ver k7BaseX)
      k7.model.position.x = k7BaseX + Math.sin(t * Math.PI) * desplazar;
      if (t >= 1) { k7.model.position.x = k7BaseX; resolve(); return; }
      requestAnimationFrame(step);
    })();
  });
}
export async function saltosProfe() {
  await saltoLadeado(-1);
  await saltoLadeado(1);
}

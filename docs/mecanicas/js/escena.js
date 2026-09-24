/* Expedición Docente · El escenario 3D: renderer, cámara, luces, los dos
 * personajes (K-7 y la profe Vero) y las herramientas para animar la cámara.
 * Es la base de todo lo demás: no importa ningún otro módulo de js/. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { K7 } from '../character/k7.js';
import { Profesora } from '../character/profesora.js';

const errBox = document.getElementById('err');
export const fail = (m) => { errBox.style.display = 'block'; errBox.textContent += m + '\n'; };
window.addEventListener('error', e => fail(e.message));

/* ===================================================================== 3D */

const app = document.getElementById('app');
export const scene = new THREE.Scene();

export const FOV_K7 = 34;   // fov "normal", frente a K-7; el tablero puede ensancharlo (ver poseTablero)
export const camera = new THREE.PerspectiveCamera(FOV_K7, innerWidth / innerHeight, 0.1, 100);
// toma frontal fija, como en Animal Crossing: nada de orbitar
export const VIEW_DIR = new THREE.Vector3(0.16, 0.13, 1).normalize();

/* Cuánto se aleja la cámara de lo justo para que K-7 quepa: le deja aire
   alrededor en vez de pegarse a la silueta. */
export const RETROCESO = 1.34;

/* En vertical hay que retroceder más. El alto se resuelve solo -frame() mide
   el hueco real entre la barra y la caja de diálogo-, pero el ancho no: con
   el cuadro angosto, lo que cabe a lo ancho se encoge, repartirProps() cae a
   su separación mínima y los muebles del aula se amontonan encima de K-7.
   Va con el aspecto y no con un ancho fijo en px porque el aspecto es de
   donde viene el problema: así también cubre una tablet en vertical o un
   móvil apaisado, sin un breakpoint que adivinar. */
const ASPECTO_ANCHO = 4 / 3;      // de aquí en adelante, sin retroceso extra
const ASPECTO_ESTRECHO = 9 / 16;  // móvil en vertical: retroceso completo
const RETROCESO_ESTRECHO = 1.18;

/* 0 en apaisado, 1 en móvil vertical. Lo usan el retroceso de la cámara y la
   separación mínima de los muebles: las dos cosas que se estropean cuando el
   cuadro se vuelve estrecho. */
export function estrechez() {
  return THREE.MathUtils.clamp(
    (ASPECTO_ANCHO - camera.aspect) / (ASPECTO_ANCHO - ASPECTO_ESTRECHO), 0, 1);
}

export function retrocesoPorAspecto() {
  return THREE.MathUtils.lerp(1, RETROCESO_ESTRECHO, estrechez());
}

export const TARGET = new THREE.Vector3(0, 1.0, 0);

export const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

// misma luz del visor: fondo claro y sombra suave proyectada en el suelo
scene.add(new THREE.HemisphereLight(0xd8e4f5, 0x9aa6b8, 1.35));

const key = new THREE.DirectionalLight(0xffffff, 2.1);
key.position.set(1.8, 6.2, 2.2);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.radius = 3;
key.shadow.bias = -0.0012;
const s = key.shadow.camera;
// el volumen cubre tambien los muebles del fondo, no solo a K-7: justo lo
// que ocupan, porque estirarlo de mas reparte los mismos texels en mas area
s.left = -5.0; s.right = 4.0; s.top = 5.0; s.bottom = -4.0; s.near = 0.5; s.far = 18;
scene.add(key);

const fill = new THREE.DirectionalLight(0xcfe0ff, 0.55);
fill.position.set(-3.5, 1.6, 2.2);
scene.add(fill);

const rim = new THREE.DirectionalLight(0xffffff, 0.45);
rim.position.set(0, 2.4, -4.0);
scene.add(rim);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(6.5, 64).rotateX(-Math.PI / 2),
  new THREE.ShadowMaterial({ opacity: 0.20 })
);
ground.receiveShadow = true;
scene.add(ground);

/* ------------------------------------------------------- K-7 habla ------ */
/* Modelos, boca/ojos intercambiables y paletas viven en character/k7.js,
   compartido con el resto de la escena. Aqui solo se usa k7.hablar()/k7.bocaEnReposo
   para el lipsync y el cabeceo al hablar; ver character/README.md. */

export const k7 = new K7({
  THREE, GLTFLoader, base: './character',
  onError: fail,
});

/* --------------------------------------------------- la profe Vero ------ */
/* Vero es la Profesora de character/profesora.js. No esta en escena desde el
   principio: entra caminando por la derecha en 1.5, cuando K-7 la anuncia
   (ver entrarProfesora y el nodo con `entra: true`). Hasta entonces el
   encuadre es solo de K-7. */

export const profesora = new Profesora({
  THREE, GLTFLoader, base: './character',
  onError: fail,
});

// K-7 fijo en Paleta 3 (ver character/paleta.js, constructor de K7): sin
// selector. Vero se suma solo con la cara: sus ojos y su boca llevan los
// materiales de K-7, asi que los dos quedan del mismo color (ver mas abajo,
// donde se carga y se le aplica la misma paleta que a K-7).
export const clock = new THREE.Clock();

/* Encuadre que comparten el elenco y la pizarra: frame() (ver elenco.js)
   deja aquí la pose normal frente a K-7, y la pizarra (ver imagenes.js) marca
   cuándo la cámara está mirando al tablero. */
export const vista = {
  camPoseK7: null,      // pose "normal" frente a K-7, la que deja frame()
  inBoardView: false,   // true mientras la cámara mira al tablero
};

let camAnim = null;         // tween de cámara en curso, o null si no hay

function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2; }

// mueve cámara+objetivo (y fov, si `to` trae uno) de donde están ahora hasta
// `to` en `dur` ms
export function tweenCamera(to, dur, onDone) {
  camAnim = {
    t0: performance.now(), dur, onDone,
    from: { pos: camera.position.clone(), target: TARGET.clone(), fov: camera.fov },
    to: { fov: camera.fov, ...to },
  };
}

export function esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

function easeOutCubic(t) { return 1 - (1 - t) ** 3; }

/* interpola una propiedad numérica de un objeto three (posición, rotación…)
   con requestAnimationFrame; devuelve una promesa que resuelve al terminar */
export function tweenProp(obj, campo, hasta, dur, ease = easeOutCubic) {
  return new Promise((resolve) => {
    const desde = obj[campo];
    const t0 = performance.now();
    (function step() {
      const t = Math.min(1, (performance.now() - t0) / dur);
      obj[campo] = desde + (hasta - desde) * ease(t);
      if (t >= 1) { resolve(); return; }
      requestAnimationFrame(step);
    })();
  });
}

/* Media suavizada de lo que dura un fotograma: la máquina de escribir la usa
   para sostener su velocidad aunque la escena no vaya a 60 (ver RITMO en
   motor.js). La alimenta el bucle de render (ver main.js). */
export let msPorFotograma = 16.7;   // media suavizada, la alimenta el bucle de render
export function medirFotograma(dt) {
  msPorFotograma += (dt * 1000 - msPorFotograma) * 0.08;
}

// un paso del tween de cámara en curso o, si no hay, de la respiración mínima
export function moverCamara() {

  if (camAnim) {
    const t = Math.min(1, (performance.now() - camAnim.t0) / camAnim.dur);
    const e = easeInOutCubic(t);
    camera.position.lerpVectors(camAnim.from.pos, camAnim.to.pos, e);
    TARGET.lerpVectors(camAnim.from.target, camAnim.to.target, e);
    if (camAnim.from.fov !== camAnim.to.fov) {
      camera.fov = THREE.MathUtils.lerp(camAnim.from.fov, camAnim.to.fov, e);
      camera.updateProjectionMatrix();
    }
    if (t >= 1) { const done = camAnim.onDone; camAnim = null; done?.(); }
  } else {
    const t = performance.now() * 0.0004;
    // respiración mínima de cámara: la escena nunca queda del todo quieta
    camera.position.x += Math.sin(t) * 0.00035;
  }
  camera.lookAt(TARGET);
}

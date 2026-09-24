/* Expedición Docente · Las imágenes del guion: la pizarra (zoom al tablero con
 * tiza), la ventana que flota sobre la escena, las láminas de las insignias del
 * epílogo, la lupa para verlas en grande y el botón para bajar el mensaje. */
import * as THREE from 'three';
import { camera, FOV_K7, vista, tweenCamera, esperar } from './escena.js';
import { boardBox, accesoriosK7 } from './aula.js';
import { flushPending, addEntry, pendingWho } from './historial.js';
import { V } from '../guiones/estado.js';

/* --------------------------------------------------- pizarra (transición) */
/* Cuando K-7 termina de explicar una actividad, la cámara deja de mirarlo a
   él y hace zoom al Tablero de implementos.glb; ahí "aparece" una imagen con
   un estallido de partículas de tiza, como si se hubiera rayado de golpe.
   Al avanzar el guion, el mismo camino se recorre en reversa. Todo vive aquí
   porque solo lo usa el guion (más abajo), nada del resto de la escena. */

const elChalk    = document.getElementById('chalk');
const elBoardImg = document.getElementById('board-img');
const elInsigniaImg = document.getElementById('insignia-img');
const ctxChalk   = elChalk.getContext('2d');
const elBoxWrap = document.getElementById('box-wrap');
const elPeek    = document.getElementById('peek-btn');
const elVentana    = document.getElementById('ventana');
const elVentanaImg = document.getElementById('ventana-img');

const elLupa = document.getElementById('lupa');
const elLupaImg = document.getElementById('lupa-img');
const elAvisoPeek = document.getElementById('aviso-peek');

let chalkParticles = [];    // partículas de tiza vivas
export let pizarraActiva = false;  // la imagen está mostrándose (a la espera de un clic)
export let pizarraAnimando = false; // zoom/estallido en curso: ignora clics
export let ventanaActiva = false;  // imagen flotando sobre la escena (ver #ventana)

export function mostrarVentana(src) {
  elVentanaImg.src = src;
  elVentana.classList.add('on');
  ventanaActiva = true;
  elPeek.classList.add('on');      // igual que con la pizarra: se puede bajar el mensaje
  prepararLupa(elVentanaImg, src, 'Imagen compartida, ampliada');
  mostrarAvisoPeek();
}
export function ocultarVentana() {
  elVentana.classList.remove('on');
  ventanaActiva = false;
  if (!pizarraActiva) elPeek.classList.remove('on');
  bajarMensaje(false);
}

export function resizeChalk() {
  elChalk.width = innerWidth * devicePixelRatio;
  elChalk.height = innerHeight * devicePixelRatio;
  elChalk.style.width = innerWidth + 'px';
  elChalk.style.height = innerHeight + 'px';
}

// pose frente al tablero: recalculada cada vez (el fov efectivo cambia con
// el aspect de la ventana), a diferencia de vista.camPoseK7 que frame() ya cachea
//
// El tablero es bien apaisado (~2:1). En un celular en vertical el fov
// horizontal disponible es angosto, y pedirle a la cámara que retroceda lo
// suficiente para que ese ancho entre completo la mandaba tan atrás que
// terminaba detrás de K-7 -literalmente con K-7 de por medio, tapando el
// tablero-. La distancia ahora se fija solo por el alto (con el fov base:
// eso es lo que ya garantiza no pasarse de largo) y el ancho se resuelve
// ensanchando el fov en ese mismo punto, no alejando más la cámara. El
// sobrante vertical que deja un fov más ancho es solo un poco más de aula
// alrededor del tablero, nunca K-7 de por medio.
function poseTablero() {
  if (!boardBox) return null;
  const center = boardBox.getCenter(new THREE.Vector3());
  const size = boardBox.getSize(new THREE.Vector3());
  const dir = new THREE.Vector3(0.05, 0.05, 1).normalize();   // casi de frente
  const MARGEN = 1.25;   // para que el tablero no quede a ras del encuadre

  const halfFovV0 = THREE.MathUtils.degToRad(FOV_K7 * 0.5);
  const dist = (size.y * 0.5 * MARGEN) / Math.tan(halfFovV0);

  const halfFovHNecesario = Math.atan((size.x * 0.5 * MARGEN) / dist);
  const halfFovVNecesario = Math.atan(Math.tan(halfFovHNecesario) / camera.aspect);
  const fov = Math.min(100, Math.max(FOV_K7, THREE.MathUtils.radToDeg(halfFovVNecesario) * 2));

  return { pos: center.clone().addScaledVector(dir, dist), target: center.clone(), fov };
}

// rectángulo en píxeles que ocupa la cara visible del tablero, con la cámara
// ya en su pose actual — así se posiciona la imagen encima de él
export function rectoTablero(pad = 0.10) {
  const anchoX = boardBox.max.x - boardBox.min.x, anchoY = boardBox.max.y - boardBox.min.y;
  const z = boardBox.max.z;   // cara que mira hacia K-7 / la cámara
  const a = new THREE.Vector3(boardBox.min.x + anchoX * pad, boardBox.min.y + anchoY * pad, z).project(camera);
  const b = new THREE.Vector3(boardBox.max.x - anchoX * pad, boardBox.max.y - anchoY * pad, z).project(camera);
  const xs = [a.x, b.x].map((x) => (x * 0.5 + 0.5) * innerWidth);
  const ys = [a.y, b.y].map((y) => (1 - (y * 0.5 + 0.5)) * innerHeight);
  const left = Math.min(...xs), top = Math.min(...ys);
  return { left, top, width: Math.max(...xs) - left, height: Math.max(...ys) - top };
}

export function ponerRectoImg(r) {
  elBoardImg.style.left = r.left + 'px';
  elBoardImg.style.top = r.top + 'px';
  elBoardImg.style.width = r.width + 'px';
  elBoardImg.style.height = r.height + 'px';
}

// estalla un puñado de motas de tiza dentro de `rect`; en reversa salen con
// menos fuerza y hacia arriba, como si el borrador las levantara
function chalkBurst(rect, { reverse = false } = {}) {
  for (let i = 0; i < 70; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = reverse ? 15 + Math.random() * 30 : 40 + Math.random() * 90;
    chalkParticles.push({
      x: rect.left + Math.random() * rect.width,
      y: rect.top + Math.random() * rect.height,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - (reverse ? 70 : 0),
      life: 0, dur: 0.45 + Math.random() * 0.35,
      r: 1.4 + Math.random() * 2.4,
    });
  }
}

export function actualizarChalk(dt) {
  if (!chalkParticles.length) return;
  ctxChalk.clearRect(0, 0, elChalk.width, elChalk.height);
  ctxChalk.save();
  ctxChalk.scale(devicePixelRatio, devicePixelRatio);
  const vivas = [];
  for (const p of chalkParticles) {
    p.life += dt;
    if (p.life >= p.dur) continue;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 55 * dt;
    ctxChalk.globalAlpha = (1 - p.life / p.dur) * 0.85;
    ctxChalk.fillStyle = '#f4f1e8';
    ctxChalk.beginPath();
    ctxChalk.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctxChalk.fill();
    vivas.push(p);
  }
  ctxChalk.restore();
  chalkParticles = vivas;
  if (!vivas.length) ctxChalk.clearRect(0, 0, elChalk.width, elChalk.height);
}

export async function mostrarPizarra(src) {
  if (pizarraAnimando || pizarraActiva) return;
  const pose = poseTablero();
  if (!pose) return;   // implementos.glb no llegó a tiempo: sin pizarra, sin frenar el guion
  pizarraAnimando = true;
  vista.inBoardView = true;
  await new Promise((res) => tweenCamera(pose, 900, res));
  const rect = rectoTablero();
  chalkBurst(rect);
  await esperar(260);
  // precarga antes de revelar: si no, un instante se alcanza a ver la
  // imagen anterior (o el hueco vacío) mientras esta decodifica
  await new Promise((res) => { elBoardImg.onload = res; elBoardImg.onerror = res; elBoardImg.src = src; });
  ponerRectoImg(rect);
  elBoardImg.style.opacity = '1';
  pizarraActiva = true;
  pizarraAnimando = false;
  elPeek.classList.add('on');
  prepararLupa(elBoardImg, src, 'Imagen del tablero, ampliada');
  mostrarAvisoPeek();

  // que quede también en el historial, como un mensaje aparte justo después
  // del texto que la mostró (por eso se adelanta el flushPending de aquí:
  // si no, el siguiente next() la pondría en el historial antes que la
  // imagen y quedarían al revés)
  flushPending();
  addEntry((pendingWho === V ? 'k7 vero' : 'k7') + ' img', `<img src="${src}" alt="">`, pendingWho);
}

/* ------------------------------ zoom a la banda scout (solo epílogo) --- */
/* Mismo recurso que el zoom al tablero, pero apuntando al pecho de K-7: cuando
   nombra cada ámbito UNESCO, la cámara se acerca a la insignia que le
   corresponde y esa insignia aparece ahí mismo. Al pasar a la siguiente la
   cámara se desliza por la banda sin volver al encuadre normal, así que el
   recorrido se lee como un barrido por las cinco.

   Las cinco insignias 3D van puestas en la banda desde el principio. Lo que
   aparece al acercarse es la lámina de esa expedición -la misma medalla que se
   gana al cerrarla- flotando sobre la insignia, igual que las imágenes se
   asoman sobre el tablero. */
export let insigniaActiva = 0;      // 0 = ninguna; si no, el número de la que se mira

function insigniaDe(n) {
  return accesoriosK7.find((a) => a.name === 'Insignia' + n) || null;
}

const LAMINA_INSIGNIA = {
  1: 'img/exp1/insignia-expedicion1.webp',
  2: 'img/exp2/insignia-exp2-alt.webp',
  3: 'img/exp3/insignia-exp3-alt.webp',
  4: 'img/exp4/insignia4-alt.webp',
  5: 'img/exp5/insignia5-alt.webp',
};

export function reiniciarInsignias() {
  elInsigniaImg.classList.remove('on');
  elInsigniaImg.removeAttribute('src');
  insigniaActiva = 0;
}

/* La lámina se pega a la insignia en pantalla, y se recoloca en cada
   fotograma: la banda cuelga del torso, el torso respira con la animación de
   reposo, y una posición calculada una sola vez se despegaría enseguida. */
export function ponerLaminaInsignia() {
  const ins = insigniaDe(insigniaActiva);
  if (!ins) return;
  const p = new THREE.Vector3();
  ins.getWorldPosition(p);
  p.project(camera);
  const alto = innerHeight * 0.34;
  const ancho = alto * 0.657;          // la proporción de las láminas
  const x = (p.x * 0.5 + 0.5) * innerWidth;
  const y = (1 - (p.y * 0.5 + 0.5)) * innerHeight;
  elInsigniaImg.style.width = ancho + 'px';
  elInsigniaImg.style.height = alto + 'px';
  elInsigniaImg.style.left = (x - ancho / 2) + 'px';
  elInsigniaImg.style.top = (y - alto / 2) + 'px';
}

// encuadre cerrado sobre una insignia, calculado sobre su posición real: la
// banda cuelga del hueso del torso, así que se mueve con él
function poseInsignia(n) {
  const ins = insigniaDe(n);
  if (!ins) return null;
  const centro = new THREE.Vector3();
  ins.getWorldPosition(centro);
  // un pelo por delante del pecho y ligeramente de lado, para que la banda se
  // lea en diagonal y no de frente aplastada
  const dir = new THREE.Vector3(0.22, 0.06, 1).normalize();
  // Cuánta banda entra en cuadro, en unidades de mundo. La banda entera mide
  // ~0.43 de alto: con menos que esto el plano queda tan cerrado que ya no se
  // entiende que es el pecho de K-7, solo aros de colores.
  const ALTO_ENCUADRE = 0.78;
  const dist = (ALTO_ENCUADRE * 0.5) / Math.tan(THREE.MathUtils.degToRad(FOV_K7 * 0.5));
  return { pos: centro.clone().addScaledVector(dir, dist), target: centro.clone(), fov: FOV_K7 };
}

export async function mostrarInsignia(n) {
  if (pizarraAnimando) return;
  const pose = poseInsignia(n);
  const ins = insigniaDe(n);
  if (!pose || !ins) return;   // sin accesorios cargados: el guion no se frena
  pizarraAnimando = true;
  const primera = !insigniaActiva;
  // si venía mirando otra, esa lámina se retira antes de mover la cámara
  elInsigniaImg.classList.remove('on');
  insigniaActiva = n;
  // la primera acerca desde el encuadre normal; las siguientes se deslizan
  await new Promise((res) => tweenCamera(pose, primera ? 900 : 700, res));
  // precargar antes de mostrar: si no, se alcanza a ver la lámina anterior
  await new Promise((res) => {
    elInsigniaImg.onload = res; elInsigniaImg.onerror = res;
    elInsigniaImg.src = LAMINA_INSIGNIA[n];
  });
  ponerLaminaInsignia();
  elInsigniaImg.classList.add('on');
  pizarraAnimando = false;
}

export async function ocultarInsignia() {
  if (pizarraAnimando || !insigniaActiva) return;
  pizarraAnimando = true;
  elInsigniaImg.classList.remove('on');
  insigniaActiva = 0;
  await esperar(220);          // que la lámina termine de irse antes de alejar
  await new Promise((res) => tweenCamera(vista.camPoseK7, 900, res));
  elInsigniaImg.removeAttribute('src');
  pizarraAnimando = false;
}

export async function ocultarPizarra() {
  if (pizarraAnimando || !pizarraActiva) return;
  pizarraAnimando = true;
  pizarraActiva = false;
  bajarMensaje(false);        // si se había bajado para mirar, que vuelva antes de cerrar
  if (!ventanaActiva) elPeek.classList.remove('on');
  // deja de capturar clics: si no, seguiría comiéndose los de avanzar
  elBoardImg.style.pointerEvents = 'none';
  elBoardImg.onclick = null;
  elBoardImg.style.opacity = '0';
  chalkBurst(rectoTablero(), { reverse: true });
  await esperar(280);
  elBoardImg.removeAttribute('src');   // que no quede colgada para el próximo zoom
  await new Promise((res) => tweenCamera(vista.camPoseK7, 900, res));
  vista.inBoardView = false;
  pizarraAnimando = false;
}

// baja el mensaje -y su etiqueta- un momento para ver la imagen completa;
// solo tiene sentido mientras hay una en pantalla (pizarra o ventana)
export let mensajeBajado = false;
export function bajarMensaje(bajar = !mensajeBajado) {
  mensajeBajado = bajar;
  elBoxWrap.classList.toggle('peek', mensajeBajado);
  elPeek.innerHTML = mensajeBajado ? '&#9652;' : '&#9662;';
  if (mensajeBajado) cerrarAvisoPeek();   // ya lo descubrió: el aviso sobra
}

/* Hasta la primera imagen todo se ha hecho a clics, así que el botón de bajar
   el mensaje no se descubre solo. Se enseña una única vez en todo el
   recorrido, y se retira en cuanto se usa el botón o pasan unos segundos. */
let avisoPeekVisto = false;
function mostrarAvisoPeek() {
  if (avisoPeekVisto) return;
  avisoPeekVisto = true;
  elAvisoPeek.classList.add('on');
  // si no lo usa, se va solo: es una pista, no un diálogo que haya que cerrar
  setTimeout(cerrarAvisoPeek, 9000);
}
function cerrarAvisoPeek() {
  elAvisoPeek.classList.remove('on');
}

/* ---------------------------------------------------------------- lupa --- */
/* Abrir una imagen a tamaño completo y acercarla. La usan las tres formas de
   mostrar una imagen -la pizarra, la ventana que flota sobre la escena y el
   resumen de conclusiones-, que viven en capas distintas, así que la lupa se
   pone por encima de todas. Cerrarla NO avanza el guion: por eso se para la
   propagación de cada clic y se vuelve exactamente a donde se estaba. */
const ESCALA_LUPA = 2.2;   // cuánto acerca un toque sobre la imagen

function ponerLupa(escala, x, y) {
  elLupaImg.style.setProperty('--escala', escala);
  elLupaImg.style.setProperty('--x', x + 'px');
  elLupaImg.style.setProperty('--y', y + 'px');
}

function abrirLupa(src, alt) {
  if (!src) return;
  elLupaImg.src = src;
  elLupaImg.alt = alt || 'Imagen ampliada';
  elLupa.classList.remove('zoom');
  ponerLupa(1, 0, 0);
  elLupa.classList.add('on');
}

export function cerrarLupa() {
  elLupa.classList.remove('on', 'zoom');
  ponerLupa(1, 0, 0);
}

export const lupaAbierta = () => elLupa.classList.contains('on');

/* Deja una imagen lista para abrirse en la lupa de un toque. Se le devuelven
   los eventos de puntero -la pizarra los lleva apagados para no estorbar a
   los clics de avanzar- y se marca con el cursor de acercar. */
export function prepararLupa(img, src, alt) {
  if (!img) return;
  img.style.pointerEvents = 'auto';
  img.style.cursor = 'zoom-in';
  img.onclick = (e) => {
    e.stopPropagation();          // que no cuente como "avanzar el guion"
    abrirLupa(src || img.currentSrc || img.src, alt || img.alt);
  };
}

/* Acercar y alejar. Al alejar se vuelve al centro: si no, la imagen se queda
   descolocada y al volver a acercar aparece por una esquina. */
function alternarZoomLupa() {
  const acercar = !elLupa.classList.contains('zoom');
  elLupa.classList.toggle('zoom', acercar);
  ponerLupa(acercar ? ESCALA_LUPA : 1, 0, 0);
}

/* Arrastre con el ratón (y con el dedo: pointer events cubre los dos). El
   desplazamiento se limita a lo que de verdad sobresale de la pantalla, para
   que no se pueda tirar la imagen fuera y quedarse mirando el vacío. */
let arrastre = null;

function topeLupa() {
  const r = elLupaImg.getBoundingClientRect();
  return {
    x: Math.max(0, (r.width - innerWidth) / 2 + 24),
    y: Math.max(0, (r.height - innerHeight) / 2 + 24),
  };
}

function soltarArrastre(e) {
  if (!arrastre) return false;
  elLupaImg.classList.remove('arrastrando');
  try {
    if (elLupaImg.hasPointerCapture?.(e.pointerId)) elLupaImg.releasePointerCapture(e.pointerId);
  } catch {}
  // si hubo arrastre de verdad, el clic que viene detrás no debe alejar
  const movido = arrastre.movido;
  arrastre = null;
  return movido;
}

/* ------------------------------------------------ precarga de imágenes --- */
/* Todas las imágenes de pizarra/ventana/conclusión del guion completo se
   conocen de antemano y pesan poco (ya van optimizadas en .webp): se
   piden en segundo plano, de a una, durante los ratos libres del navegador,
   para que ya estén en la caché cuando el guion las necesite. Antes se
   pedían recién al cerrar las puertas o al hacer zoom al tablero, y ese
   fetch a mitad de la transición era la demora que se sentía. */
export function imagenesDelGuion(nodos) {
  const set = new Set();
  for (const n of nodos) {
    if (n.board) set.add(n.board);
    if (n.ventana) set.add(n.ventana);
    if (n.conclusion) { set.add(n.conclusion.resumen); set.add(n.conclusion.insignia); }
  }
  return [...set];
}
export function precargarImagenes(rutas) {
  const programar = window.requestIdleCallback
    ? (fn) => requestIdleCallback(fn, { timeout: 2000 })
    : (fn) => setTimeout(fn, 300);
  let i = 0;
  // De a una de verdad: la siguiente no se pide hasta que la anterior
  // terminó. Antes esto era un `while` sobre el deadline del idle callback,
  // pero asignar .src no consume tiempo medible -vuelve enseguida-, así que
  // el deadline nunca se agotaba y las ~34 imágenes salían todas juntas,
  // justo mientras se estaban descargando los .glb y se armaba la escena.
  const siguiente = () => {
    if (i >= rutas.length) return;
    const img = new Image();
    img.decoding = 'async';       // decodificar nunca en el hilo principal
    img.fetchPriority = 'low';    // siempre detrás de lo que ya está en pantalla
    img.onload = img.onerror = () => programar(siguiente);
    img.src = rutas[i++];
  };
  programar(siguiente);
}

// escucha de la lupa y del botón de bajar el mensaje (ver main.js)
export function iniciarImagenes() {
  resizeChalk();

  elLupaImg.addEventListener('pointerdown', (e) => {
    if (!elLupa.classList.contains('zoom')) return;
    e.preventDefault();
    e.stopPropagation();
    const x = parseFloat(elLupaImg.style.getPropertyValue('--x')) || 0;
    const y = parseFloat(elLupaImg.style.getPropertyValue('--y')) || 0;
    arrastre = { px: e.clientX, py: e.clientY, x, y, movido: false };
    elLupaImg.classList.add('arrastrando');
    // lanza si el puntero ya no está activo; el arrastre funciona igual sin captura
    try { elLupaImg.setPointerCapture(e.pointerId); } catch {}
  });

  elLupaImg.addEventListener('pointermove', (e) => {
    if (!arrastre) return;
    const dx = e.clientX - arrastre.px;
    const dy = e.clientY - arrastre.py;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) arrastre.movido = true;
    const tope = topeLupa();
    ponerLupa(
      ESCALA_LUPA,
      Math.max(-tope.x, Math.min(tope.x, arrastre.x + dx)),
      Math.max(-tope.y, Math.min(tope.y, arrastre.y + dy)),
    );
  });

  elLupaImg.addEventListener('pointerup', (e) => { elLupaImg.dataset.movido = soltarArrastre(e) ? '1' : ''; });
  elLupaImg.addEventListener('pointercancel', soltarArrastre);

  // un toque en la imagen la acerca o la aleja; fuera de ella, o en la X, cierra
  elLupaImg.addEventListener('click', (e) => {
    e.stopPropagation();
    if (elLupaImg.dataset.movido) { elLupaImg.dataset.movido = ''; return; }  // venía de arrastrar
    alternarZoomLupa();
  });
  elLupa.addEventListener('click', (e) => { e.stopPropagation(); cerrarLupa(); });
  document.getElementById('lupa-cerrar').addEventListener('click', (e) => {
    e.stopPropagation(); cerrarLupa();
  });

  elPeek.addEventListener('click', () => { if (pizarraActiva || ventanaActiva) bajarMensaje(); });
}

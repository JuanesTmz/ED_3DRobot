/* Laboratorio de mecánicas · lo que comparten todas las mecánicas.
 *
 *   ventana()      la ventana donde ocurre cada mecánica: centrada, sobre el
 *                  aula atenuada, con encabezado (estación, título, qué hacer,
 *                  progreso), cuerpo y pie (lo que dice K-7 + botones)
 *   k7Dice()       lo que K-7 comenta: en el pie de la ventana si hay una
 *                  abierta; si no, en un rótulo abajo, sobre la escena
 *   camara*()      mover la cámara real: frente al tablero, o de vuelta a K-7
 *   mano()         la mano que enseña un gesto poco evidente, una sola vez
 *   iniciarLab()   el menú de estaciones: la entrada al laboratorio y el
 *                  botón «Estaciones» de la barra de arriba
 *
 * Sin puntos, sin sonidos, sin celebraciones: la única medida de avance es el
 * progreso (el anillo de la línea de tiempo y la barra de cada ventana). */
import * as THREE from 'three';
import { camera, vista, tweenCamera, k7, FOV_K7, esperar } from './escena.js';
import { boardBox } from './aula.js';
import { FASES, partida } from './partida.js';

/* ------------------------------------------------------------ estado --- */

export const lab = {
  // ritmo del diálogo: 'rafagas' (varios mensajes por clic) o 'clasico'
  // (uno por clic, como hoy). Se elige en el menú de estaciones.
  ritmo: 'rafagas',
  // estación donde arranca el guion (ver start() en motor.js): la de
  // ?estacion=N, o la que se elija en el menú antes de que cargue el aula
  inicio: 0,
  arrancado: false,   // start() ya corrió: de aquí en adelante se salta
  terminado: false,   // se llegó al final de la estación 6
};
const params = new URLSearchParams(location.search);
try {
  const r = params.get('ritmo') || localStorage.getItem('lab-mecanicas-ritmo');
  if (r === 'clasico' || r === 'rafagas') lab.ritmo = r;
} catch {}
// ?estacion=N entra directo, sin menú: sirve para compartir una sola
// mecánica, y para que recargar no devuelva al principio
const pedida = Number(params.get('estacion'));
const directa = pedida >= 1 && pedida <= FASES.length ? Math.trunc(pedida) - 1 : null;
if (directa != null) lab.inicio = directa;

const $ = (id) => document.getElementById(id);
export const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ----------------------------------------------------------- ventana --- */

let activa = false;
let limpiezas = [];
let ventanaAbierta = null;
const elMec = $('mec');

export const mecanicaActiva = () => activa;

export function entrarMecanica() {
  activa = true;
  document.body.classList.add('mec-on');
}

export function salirMecanica() {
  activa = false;
  document.body.classList.remove('mec-on');
  callarK7();
  for (const fn of limpiezas.splice(0)) { try { fn(); } catch {} }
  elMec.innerHTML = '';
  elMec.className = '';
  ventanaAbierta = null;
}

// lo que una mecánica deja escuchando (teclado, resize…) se registra aquí
// para desarmarlo al terminar o al saltar a otra estación
export function alSalir(fn) { limpiezas.push(fn); }

/* Abre la ventana de una mecánica y devuelve sus partes:
     cuerpo       donde la mecánica pone su contenido
     progreso()   la barra y el «2 de 4» del encabezado
     titulo(), instruccion(), acciones(html), pista(fn)
     ocultar() / mostrar()   para ceder la pantalla un momento (p. ej. a los
                             pupitres) sin desarmarla
     cerrar()     la retira con su transición */
export function ventana({ estacion, color = 'c1', titulo, instruccion = '', ancho = 'amplia', clase = '' }) {
  elMec.className = 'on';
  elMec.innerHTML = `
    <div class="vent-fondo"></div>
    <section class="vent ${ancho} ${color} ${clase}" role="dialog" aria-label="${escapar(titulo.replace(/<[^>]+>/g, ''))}">
      <header class="vent-cab">
        <div class="vent-cab-txt">
          <p class="vent-est"><i></i>${estacion}</p>
          <h2 class="vent-tit">${titulo}</h2>
          <p class="vent-inst">${instruccion}</p>
        </div>
        <div class="vent-lado">
          <span class="vent-prog"></span>
          <button type="button" class="vent-pista" hidden>¿Una pista?</button>
        </div>
        <div class="vent-barra"><i></i></div>
      </header>
      <div class="vent-cuerpo"></div>
      <footer class="vent-pie">
        <div class="vent-k7">
          <span class="vent-k7-cara"><img src="img/k7.webp" alt=""></span>
          <p class="vent-k7-txt"></p>
        </div>
        <div class="vent-acc"></div>
      </footer>
    </section>`;
  const el = elMec.querySelector('.vent');
  const fondo = elMec.querySelector('.vent-fondo');
  requestAnimationFrame(() => { el.classList.add('on'); fondo.classList.add('on'); });

  const v = {
    el,
    cuerpo: el.querySelector('.vent-cuerpo'),
    progreso(actual, total, texto) {
      el.querySelector('.vent-barra i').style.width = total ? (actual / total) * 100 + '%' : '0';
      el.querySelector('.vent-prog').textContent = texto ?? (total ? `${actual} de ${total}` : '');
    },
    titulo(html) { el.querySelector('.vent-tit').innerHTML = html; },
    instruccion(html) { el.querySelector('.vent-inst').innerHTML = html; },
    acciones(html) {
      const acc = el.querySelector('.vent-acc');
      acc.innerHTML = html;
      return acc;
    },
    pista(fn) {
      const b = el.querySelector('.vent-pista');
      b.hidden = !fn;
      b.onclick = fn ? (e) => { e.stopPropagation(); fn(); } : null;
    },
    visible: true,
    ocultar() { v.visible = false; el.classList.remove('on'); fondo.classList.remove('on'); return esperar(250); },
    mostrar() { v.visible = true; el.classList.add('on'); fondo.classList.add('on'); return esperar(250); },
    async cerrar() { await v.ocultar(); },
  };
  ventanaAbierta = v;
  return v;
}

/* ------------------------------------------------------- K-7 comenta --- */

let rotuloT = null;
let bocaT = null;

export function k7Dice(texto, { emote = null, ms = null } = {}) {
  if (emote && k7.model) k7.reproducir(emote);
  const largo = texto.replace(/<[^>]+>/g, '').length;
  k7.hablar(true);
  clearTimeout(bocaT);
  bocaT = setTimeout(() => k7.hablar(false), Math.min(2600, 500 + largo * 28));

  // con una ventana abierta, K-7 habla desde su pie
  const pie = ventanaAbierta?.visible && ventanaAbierta.el.querySelector('.vent-k7-txt');
  if (pie) {
    pie.innerHTML = texto;
    pie.classList.remove('nuevo');
    void pie.offsetWidth;
    pie.classList.add('nuevo');
    return;
  }
  const el = $('k7-toast');
  el.querySelector('.k7-toast-texto').innerHTML = texto;
  el.classList.add('on');
  clearTimeout(rotuloT);
  rotuloT = setTimeout(() => el.classList.remove('on'), ms ?? Math.max(3000, 1200 + largo * 50));
}

export function callarK7() {
  clearTimeout(rotuloT);
  clearTimeout(bocaT);
  k7.hablar(false);
  $('k7-toast').classList.remove('on');
}

/* -------------------------------------------------------------- mano --- */
/* La mano de img/mano.png (la misma del aviso de la pizarra). Solo para
   gestos que no se adivinan, como tocar una imagen. Se va al primer toque. */

export function mano(objetivo) {
  const r = objetivo.getBoundingClientRect();
  const m = document.createElement('img');
  m.src = 'img/mano.png';
  m.alt = '';
  m.className = 'mano-guia';
  m.style.left = r.left + r.width / 2 + 'px';
  m.style.top = r.top + r.height / 2 + 'px';
  document.body.appendChild(m);
  const quitar = () => { m.remove(); removeEventListener('pointerdown', quitar, true); };
  setTimeout(() => addEventListener('pointerdown', quitar, true), 50);
  setTimeout(quitar, 6000);
  alSalir(quitar);
}

/* ----------------------------------------------------------- cámara --- */
/* Mientras una ventana está abierta, la cámara mira al tablero del aula (como
   cuando se muestra una imagen en la expedición). vista.inBoardView en true
   hace que frame() (elenco.js) no la devuelva a K-7 al redimensionar. */

let encuadre = 'normal';

// la misma cuenta que poseTablero() en imagenes.js, que no se exporta
function poseTablero() {
  if (!boardBox) return null;
  const center = boardBox.getCenter(new THREE.Vector3());
  const size = boardBox.getSize(new THREE.Vector3());
  const dir = new THREE.Vector3(0.05, 0.05, 1).normalize();
  const MARGEN = 1.25;
  const halfFovV0 = THREE.MathUtils.degToRad(FOV_K7 * 0.5);
  const dist = (size.y * 0.5 * MARGEN) / Math.tan(halfFovV0);
  const halfFovH = Math.atan((size.x * 0.5 * MARGEN) / dist);
  const halfFovV = Math.atan(Math.tan(halfFovH) / camera.aspect);
  const fov = Math.min(100, Math.max(FOV_K7, THREE.MathUtils.radToDeg(halfFovV) * 2));
  return { pos: center.clone().addScaledVector(dir, dist), target: center.clone(), fov };
}

const irA = (pose, ms) => new Promise((res) => (pose ? tweenCamera(pose, ms, res) : res()));

export async function camaraTablero(ms = 850) {
  encuadre = 'tablero';
  vista.inBoardView = true;
  await irA(poseTablero(), ms);
}

export async function camaraNormal(ms = 850) {
  if (encuadre === 'normal') return;
  encuadre = 'normal';
  await irA(vista.camPoseK7, ms);
  // si otro movimiento la reemplazó y volvió al tablero, se queda en el tablero
  if (encuadre === 'normal') vista.inBoardView = false;
}

addEventListener('resize', () => requestAnimationFrame(() => {
  if (encuadre === 'tablero') irA(poseTablero(), 1);
}));

export function abortarMecanica() {
  callarK7();
  if (activa) salirMecanica();
  dispatchEvent(new Event('lab:abortar'));   // pupitres y medidor se apagan
  if (encuadre !== 'normal') {
    encuadre = 'normal';
    if (vista.camPoseK7) tweenCamera(vista.camPoseK7, 1);
    vista.inBoardView = false;
  }
}

/* ------------------------------------------------------- capas extra --- */

const elMenu = $('bienvenida');
export const capaAbierta = () => ['bienvenida', 'final'].some((id) => $(id).classList.contains('on'));

export function mostrarFinal() {
  lab.terminado = true;
  $('final').classList.add('on');
}

/* ------------------------------------------------ menú de estaciones --- */
/* Una tarjeta por estación, armada con la tarjeta de capítulo de cada una
   (guiones/estaciones.js). Dos modos:
     'inicio'  la entrada: el guion todavía no se ve (puede estar cargando)
     'pausa'   abierto desde la barra de arriba o desde el final: se puede
               cerrar y seguir donde iba */

let irAEstacion = () => {};

const AYUDA_RITMO = {
  rafagas: 'Varios mensajes de K-7 seguidos, con un solo clic.',
  clasico: 'Un mensaje por clic, como en la expedición actual.',
};

function armarMenu() {
  $('bienvenida-lista').innerHTML = FASES.map((fase, i) => {
    const c = fase[0];
    const [numero, nombre] = c.chapter.split(' · ');
    return `
      <li><button type="button" class="est ${c.color}" data-i="${i}">
        <span class="est-cab">
          <img class="est-ico" src="${c.icono}" alt="">
          <span class="est-num">${numero}</span>
          <span class="est-estado"></span>
        </span>
        <b class="est-nom">${nombre}</b>
        <span class="est-res">${c.resumen || ''}</span>
        <span class="est-pie">
          <span class="est-dur">${c.lab?.duracion || ''}</span>
          <span class="est-ir"><span class="est-ir-txt">Entrar</span> <span aria-hidden="true">&rarr;</span></span>
        </span>
      </button></li>`;
  }).join('');
}

// «En curso» y «Vista» en las tarjetas, y el botón principal según el modo
function marcarMenu() {
  const pausa = elMenu.dataset.modo === 'pausa';
  const enCurso = pausa && !lab.terminado ? partida.expActualIdx : -1;
  for (const b of elMenu.querySelectorAll('.est')) {
    const i = Number(b.dataset.i);
    const vista = pausa && partida.expedicionesEmpezadas.has(i) && i !== enCurso;
    b.classList.toggle('actual', i === enCurso);
    b.classList.toggle('vista', vista);
    b.querySelector('.est-estado').textContent = i === enCurso ? 'En curso' : vista ? 'Vista' : '';
    b.querySelector('.est-ir-txt').textContent = i === enCurso ? 'Seguir' : 'Entrar';
  }
  $('bienvenida-btn').textContent = enCurso >= 0 ? `Seguir en la Estación ${enCurso + 1}`
    : lab.terminado ? 'Recorrer las seis otra vez' : 'Recorrer las seis en orden';
  $('bienvenida-cta-nota').textContent = enCurso >= 0 ? 'donde iba' : '≈ 15 min en total';
}

function abrirMenu(modo) {
  elMenu.dataset.modo = modo;
  marcarMenu();
  $('final').classList.remove('on');
  elMenu.classList.add('on');
  elMenu.scrollTop = 0;
  // al volver a abrirlo, el foco entra al menú (Esc lo cierra)
  if (modo === 'pausa') {
    callarK7();
    requestAnimationFrame(() => $('bienvenida-btn').focus({ preventScroll: true }));
  }
}

function cerrarMenu() {
  elMenu.classList.remove('on');
  if (lab.arrancado) recordarEstacion(partida.expActualIdx);
}

function elegir(i) {
  const modo = elMenu.dataset.modo;
  cerrarMenu();
  // el aula todavía carga: start() arrancará en esa estación
  if (!lab.arrancado) { lab.inicio = i; return; }
  // la que ya está en pantalla: se sigue donde iba
  if (i === partida.expActualIdx && (modo === 'inicio' || !lab.terminado)) return;
  lab.terminado = false;
  irAEstacion(i);
}

// la URL lleva la estación en curso: recargar vuelve a ella, no al menú
function recordarEstacion(idx) {
  try {
    const url = new URL(location.href);
    url.searchParams.set('estacion', idx + 1);
    history.replaceState(null, '', url);
  } catch {}
}

// motor.js avisa cada vez que entra la tarjeta de una estación
export function estacionIniciada(idx) {
  if (!elMenu.classList.contains('on')) recordarEstacion(idx);
}

/* --------------------------------------------------------- arranque --- */

export function iniciarLab({ irAEstacion: ir }) {
  irAEstacion = ir;
  armarMenu();
  if (directa == null) abrirMenu('inicio');

  const ayuda = $('bienvenida-ritmo-ayuda');
  for (const r of document.querySelectorAll('#bienvenida input[name=ritmo]')) {
    r.checked = r.value === lab.ritmo;
    r.addEventListener('change', () => {
      lab.ritmo = r.value;
      ayuda.textContent = AYUDA_RITMO[r.value];
      try { localStorage.setItem('lab-mecanicas-ritmo', r.value); } catch {}
    });
  }
  ayuda.textContent = AYUDA_RITMO[lab.ritmo];

  $('bienvenida-lista').addEventListener('click', (e) => {
    const b = e.target.closest('.est');
    if (b) elegir(Number(b.dataset.i));
  });
  $('bienvenida-btn').addEventListener('click', () => {
    const pausa = elMenu.dataset.modo === 'pausa' && !lab.terminado;
    elegir(pausa ? partida.expActualIdx : 0);
  });
  $('bienvenida-cerrar').addEventListener('click', cerrarMenu);
  $('menu-link').addEventListener('click', () => abrirMenu('pausa'));
  $('final-estaciones').addEventListener('click', () => abrirMenu('pausa'));

  // con el menú abierto, el teclado es suyo: que no le llegue a la mecánica
  // que quedó debajo (el 1-2-3 de la estación 3, el Enter de la 2…)
  addEventListener('keydown', (e) => {
    if (!elMenu.classList.contains('on')) return;
    e.stopPropagation();
    if (e.key === 'Escape' && elMenu.dataset.modo === 'pausa') cerrarMenu();
  }, true);

  // la confirmación de salto y las pestañas del historial son de la
  // expedición real y dicen «Expedición»: aquí son estaciones
  const texto = $('confirmar-salto-texto');
  new MutationObserver(() => {
    const nuevo = texto.innerHTML
      .replace(/la Expedición (\d)/g, 'la Estación $1')
      .replace(/de expedición/g, 'de estación');
    if (nuevo !== texto.innerHTML) texto.innerHTML = nuevo;
  }).observe(texto, { childList: true, characterData: true, subtree: true });
  const pestanas = $('log-tabs');
  new MutationObserver(() => {
    for (const b of pestanas.children) {
      const n = b.textContent.match(/^Expedición (\d)$/);
      if (n) b.textContent = `Estación ${n[1]}`;
    }
  }).observe(pestanas, { childList: true });
}

export { esperar };

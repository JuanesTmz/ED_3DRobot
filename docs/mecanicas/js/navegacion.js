/* Expedición Docente · Moverse entre fases: las puertas y el telón, la tarjeta
 * de capítulo, la de conclusión con su resumen, la línea de tiempo y la
 * confirmación de salto. No mueve el guion: cuando hace falta, llama a los
 * `alSaltar` / `alContinuar` que le pasa main.js (ver iniciarNavegacion). */
import { partida, EXPEDICIONES } from './partida.js';
import { addEntry } from './historial.js';
import { prepararLupa } from './imagenes.js';

const loaderEl  = document.getElementById('loader');
const loaderTxt = document.getElementById('loader-txt');
const loaderCopy = document.getElementById('loader-copy');
const barEl     = document.querySelector('.bar i');

/* Las mismas puertas de la carga inicial se reusan para el cambio de
   expedición (ver mostrarConclusion()): la barra de progreso no vuelve a
   aparecer, solo la hoja izquierda/derecha se cierra y se abre de nuevo. */
export function cerrarPuertas() {
  return new Promise((resolve) => {
    const puerta = loaderEl.querySelector('.door-left');
    puerta.addEventListener('transitionend', resolve, { once: true });
    loaderEl.classList.remove('done');
  });
}
export function abrirPuertas() {
  return new Promise((resolve) => {
    const puerta = loaderEl.querySelector('.door-left');
    puerta.addEventListener('transitionend', resolve, { once: true });
    loaderEl.classList.add('done');
  });
}

/* Telones de teatro: misma mecánica que cerrarPuertas()/abrirPuertas(), pero
   sobre #curtain. Se usan solo cuando node.conclusion.transicion === 'cortina'
   (ver next() y el click de #conc-btn más abajo). */
const curtainEl = document.getElementById('curtain');
export function cerrarCortinas() {
  return new Promise((resolve) => {
    const cortina = curtainEl.querySelector('.curtain-left');
    cortina.addEventListener('transitionend', resolve, { once: true });
    curtainEl.classList.remove('done');
  });
}
export function abrirCortinas() {
  return new Promise((resolve) => {
    const cortina = curtainEl.querySelector('.curtain-left');
    cortina.addEventListener('transitionend', resolve, { once: true });
    curtainEl.classList.add('done');
  });
}

// la barra y el aviso de la carga inicial (ver iniciarK7() en main.js)
export function marcarCarga(frac) {
  barEl.style.width = (frac * 100) + '%';
}
export function avisarFalloCarga() {
  loaderTxt.textContent = 'no se pudo cargar el modelo — ¿estás sirviendo la carpeta por HTTP?';
}
export function retirarBarraCarga() {
  loaderCopy.style.display = 'none';
}

// un salto por la línea de tiempo deja puertas y telón abiertos en seco
// (ver irAExpedicion() en motor.js)
export function abrirTransicionesEnSeco() {
  loaderEl.classList.add('done');
  curtainEl.classList.add('done');
}

const elChap   = document.getElementById('chapter');
const elChapIcon = document.getElementById('chapter-icon-img');
// mismo birrete que el nodo del Epílogo en la línea de tiempo (ver #timeline
// en el HTML), como data URI para poder usarlo también como <img src>
const ICONO_EPILOGO = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">' +
  '<path fill="#f5c518" d="M12 3 1 8l11 5 9-4.09V17h2V8L12 3Z"/>' +
  '<path fill="#f5c518" d="M5 10.18v3.64c0 .35.16.68.44.9C6.6 15.6 9.1 17 12 17s5.4-1.4 6.56-2.28c.28-.22.44-.55.44-.9v-3.64l-7 3.18-7-3.18Z"/>' +
  '</svg>'
);
const elChapNumero = document.getElementById('chapter-numero');
const elChapSubtitulo = document.getElementById('chapter-subtitulo');
const elChapNota = document.getElementById('chapter-nota');
const elChapCta = document.getElementById('chapter-cta');
const elChapBtn = document.getElementById('chapter-btn');

const elConclusion  = document.getElementById('conclusion');
const elConcResumen = document.getElementById('conclusion-resumen');
const elConcInsignia = document.getElementById('conclusion-insignia');
const elConcTitulo  = document.getElementById('conclusion-titulo');
const elConcBtn     = document.getElementById('conclusion-btn');
const elConcBtnIcon  = document.getElementById('conclusion-btn-icon');
const elConcBtnLabel = document.getElementById('conclusion-btn-label');
const elConcPillIcon = document.getElementById('conclusion-pill-icon-img');
const elConcPillExp  = document.getElementById('conclusion-pill-exp');
const elConcPillDim  = document.getElementById('conclusion-pill-dim');
const elConcLightbox = document.getElementById('conclusion-lightbox');
const elConcVerBtn   = document.getElementById('conclusion-ver-btn');

// Nombres de los cinco ámbitos del Marco de Competencias UNESCO, en el mismo
// orden que las expediciones (ver la píldora de #conclusion-pill): cada
// expedición ejerce uno. No aplica a la Expedición 5→Epílogo, que nunca
// pasa por conclusion() con un `siguiente` fuera de este rango.
const DIMENSIONES_UNESCO = [
  'Mentalidad centrada en el ser humano',
  'Ética de la IA',
  'Fundamentos y aplicaciones de la IA',
  'Pedagogía de la IA',
  'IA para el aprendizaje profesional',
];

export const cerrarConclusionLightbox = () => elConcLightbox.classList.remove('on');

export const capituloAbierto = () => elChap.classList.contains('on');
export const resumenAbierto = () => elConcLightbox.classList.contains('on');

// lo que un salto por la línea de tiempo cierra de golpe, esté donde esté
export function cerrarPantallas() {
  elChap.classList.remove('on');
  elConclusion.classList.remove('on');
  elConcLightbox.classList.remove('on');
}

/* --------------------------------------------------- línea de tiempo --- */
/* RECORRIDO PROGRESIVO
   Con esto en true el juego es un camino, no un menú: solo se puede entrar
   a la fase en curso, a las ya completadas y a la siguiente del frente. Las
   demás quedan `trabadas` (grises y con candado en la línea de tiempo).
   Ponerlo en false devuelve la navegación libre de siempre -sin candados ni
   marcas de completada- para poder probar cualquier expedición sin tener
   que jugarse las anteriores. Es el único interruptor: no hay que tocar
   nada más. */
const RECORRIDO_PROGRESIVO = false;   // DESACTIVADO para probar: volver a true antes de desplegar

const elTimeline = document.getElementById('timeline');
const elTlNodes = [...document.querySelectorAll('.tl-node')];
const tlTitulos = elTlNodes.map((n) => n.title);
export function marcarTimeline(idx) {
  elTlNodes.forEach((n, i) => n.classList.toggle('activo', i === idx));
}

function faseDesbloqueada(idx) {
  if (!RECORRIDO_PROGRESIVO) return true;
  if (idx === partida.expActualIdx || partida.fasesCompletadas.has(idx)) return true;
  const ultima = partida.fasesCompletadas.size ? Math.max(...partida.fasesCompletadas) : -1;
  return idx <= ultima + 1;   // el frente del recorrido: la que sigue, nada más
}

export function actualizarCandadosTimeline() {
  elTlNodes.forEach((n, i) => {
    const libre = faseDesbloqueada(i);
    n.classList.toggle('trabado', !libre);
    n.classList.toggle('completada', RECORRIDO_PROGRESIVO && partida.fasesCompletadas.has(i));
    n.title = libre ? tlTitulos[i] : `${tlTitulos[i]} · termina la anterior para desbloquearla`;
  });
}

function sacudirNodo(n) {
  n.classList.remove('sacudir');
  void n.offsetWidth;   // reinicia la animación si se hace clic dos veces seguidas
  n.classList.add('sacudir');
}

// Menú hamburguesa: cerrada solo se ve el nodo activo (el CSS colapsa a los
// demás a 0 de alto); abierta se ven todos y el activo cae a su puesto real
// en la lista, empujado por los que aparecen antes que él.
let timelineAbierta = false;
function alternarTimeline(forzar) {
  timelineAbierta = forzar ?? !timelineAbierta;
  elTimeline.classList.toggle('abierta', timelineAbierta);
}

// El nodo del Epílogo (el 6°, el último de elTlNodes) arranca oculto -ver
// `.tl-node.bloqueado` en el CSS- y se revela justo cuando se completa la
// Expedición 5 (ver node.conclusion en next()). Quitar una clase que ya no
// está no rompe nada, así que no hace falta guardarse de llamarla dos veces.
export function revelarFaseEpilogo() {
  elTlNodes[EXPEDICIONES.length]?.classList.remove('bloqueado');
}

// Qué tan cerca está el docente de terminar la expedición activa (0 a 1):
// pinta un anillo alrededor de su ícono en la línea de tiempo (ver
// .tl-node.activo::before). Es una cuenta aproximada -no cada nodo del
// guion pesa lo mismo, y las réplicas de las opciones se insertan sobre la
// marcha- pero alcanza para dar la sensación de avance.

export function actualizarProgresoTimeline(forzado) {
  const nodo = elTlNodes[partida.expActualIdx];
  if (!nodo) return;
  const p = forzado ?? Math.min(1, partida.nodosVistosExp / partida.totalNodosExp);
  nodo.style.setProperty('--progreso', p);
}

// Confirmación antes de cualquier salto manual: reinicia esa expedición
// desde cero y deja a medias la que estaba en curso, así que se avisa cada
// vez, sin excepción (incluso si el nodo elegido es el que ya está activo).
const elConfirmarSalto = document.getElementById('confirmar-salto');
const elConfirmarSaltoTexto = document.getElementById('confirmar-salto-texto');
let saltoPendiente = null;

function confirmarSalto(idx) {
  const nombre = idx < EXPEDICIONES.length ? `la Expedición ${idx + 1}` : 'el Epílogo';
  saltoPendiente = idx;
  elConfirmarSaltoTexto.innerHTML =
    `Vas a saltarte la conversación actual para ir a <b>${nombre}</b>. Puede que te pierdas información importante de donde estás ahora.<br><br>¿Seguro que quieres cambiar de expedición?`;
  elConfirmarSalto.classList.add('on');
}

/* Tarjeta de capítulo a pantalla completa (ver next() en motor.js). Un clic
   la cierra y ahí corre `alContinuar`. */
export function mostrarCapitulo(node, alContinuar) {
  // el título del guion es "Expedición N · Subtítulo" (o "Epílogo · …"):
  // se separa para mostrar el número/nombre arriba del ícono y el
  // subtítulo bajo la línea
  const [numeroTxt, ...restoTxt] = node.chapter.split(' · ');
  elChapNumero.textContent = numeroTxt;
  elChapSubtitulo.textContent = restoTxt.join(' · ');
  elChapNota.textContent = node.note || '';
  // el epílogo usa su propio birrete (igual que en la línea de tiempo) y
  // su color dorado (c6); las expediciones usan su icon-fN.webp y cN
  const esEpilogo = partida.expActualIdx === EXPEDICIONES.length;
  elChapIcon.src = esEpilogo ? ICONO_EPILOGO : `img/exp${partida.expActualIdx + 1}/icon-f${partida.expActualIdx + 1}.webp`;
  // "Empieza por aquí" solo tiene sentido la primera vez, en la Expedición 1
  elChapCta.hidden = partida.expActualIdx !== 0;
  elChapBtn.classList.remove('c1', 'c2', 'c3', 'c4', 'c5', 'c6');
  elChapBtn.classList.add(esEpilogo ? 'c6' : 'c' + (partida.expActualIdx + 1));
  elChap.classList.add('on');
  const go = () => {
    elChap.classList.remove('on');
    elChap.removeEventListener('click', go);
    alContinuar();
  };
  elChap.addEventListener('click', go);
}

/** Cierre de expedición: puertas cerradas, resumen + insignia, y un botón
 *  que las vuelve a abrir hacia la siguiente expedición (ver next()). */
export function mostrarConclusion({ resumen, insignia, titulo, boton, siguiente }) {
  elConcResumen.src = resumen;
  elConcInsignia.src = insignia;
  // la píldora habla de la expedición que se ACABA de completar
  // (partida.expActualIdx), no de la siguiente: muestra el título narrativo dentro
  // del marco, y debajo -en cursiva- el ámbito UNESCO que trabajó.
  elConcPillIcon.src = `img/exp${partida.expActualIdx + 1}/icon-f${partida.expActualIdx + 1}.webp`;
  elConcPillExp.textContent = `Expedición ${partida.expActualIdx + 1}`;
  elConcPillExp.className = 'c' + (partida.expActualIdx + 1);
  elConcPillDim.textContent = titulo;
  elConcTitulo.textContent = `UNESCO: ${DIMENSIONES_UNESCO[partida.expActualIdx] || ''}`;
  elConcBtnLabel.textContent = boton;
  elConcLightbox.classList.remove('on');
  elConcBtn.classList.remove('c2', 'c3', 'c4', 'c5');
  // última expedición (hoy, la 5): sin siguiente nivel que anunciar, así que
  // el botón se queda sin el círculo con el ícono de la próxima expedición
  elConcBtnIcon.closest('.next-exp-icon').style.display = siguiente ? '' : 'none';
  if (siguiente) {
    elConcBtn.classList.add('c' + siguiente);
    elConcBtnIcon.src = `img/exp${siguiente}/icon-f${siguiente}.webp`;
  }
  elConclusion.classList.add('on');
  addEntry('chapter', 'Insignia obtenida: ' + titulo);
}

// escucha de la conclusión, la línea de tiempo y la confirmación de salto (ver main.js)
export function iniciarNavegacion({ alSaltar, alContinuar }) {
  elConcVerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    elConcLightbox.classList.add('on');
    // el resumen también se puede acercar: suele traer letra pequeña
    prepararLupa(elConcResumen, elConcResumen.src, 'Resumen de la expedición, ampliado');
  });
  elConcLightbox.addEventListener('click', cerrarConclusionLightbox);
  // Botón de cerrar además del clic en el fondo: el fondo solo lo descubre quien
  // ya lo ha probado, y aquí el docente viene de pulsar "Ver conclusiones".
  document.getElementById('conclusion-cerrar').addEventListener('click', (e) => {
    e.stopPropagation();
    cerrarConclusionLightbox();
  });

  document.addEventListener('click', (e) => {
    if (timelineAbierta && !elTimeline.contains(e.target)) alternarTimeline(false);
  });

  document.getElementById('confirmar-salto-cancelar').addEventListener('click', () => {
    elConfirmarSalto.classList.remove('on');
    saltoPendiente = null;
  });
  document.getElementById('confirmar-salto-aceptar').addEventListener('click', () => {
    elConfirmarSalto.classList.remove('on');
    if (saltoPendiente != null) alSaltar(saltoPendiente);
    saltoPendiente = null;
  });

  // con la timeline cerrada, el primer clic solo la abre (es el botón del
  // menú); ya abierta, cualquier nodo navega de verdad y ella se vuelve a
  // cerrar sola, como cualquier desplegable al elegir una opción
  elTlNodes.forEach((n) => n.addEventListener('click', () => {
    if (!timelineAbierta) { alternarTimeline(true); return; }
    const idx = Number(n.dataset.exp);
    // fase todavía trabada: el menú se queda abierto y el nodo solo se sacude
    if (!faseDesbloqueada(idx)) { sacudirNodo(n); return; }
    alternarTimeline(false);
    confirmarSalto(idx);
  }));
  actualizarCandadosTimeline();

  elConcBtn.addEventListener('click', async () => {
    elConclusion.classList.remove('on');
    // el siguiente nodo (tarjeta de capítulo) se prepara ya, detrás de las
    // puertas/cortinas todavía cerradas: así lo que se revela al abrirlas es
    // la tarjeta, nunca la escena vacía de K-7 solo un instante
    alContinuar();
    if (partida.transicionCierre === 'cortina') await abrirCortinas();
    else await abrirPuertas();
  });
}

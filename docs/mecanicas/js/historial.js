/* Expedición Docente · El historial de la charla: lo que se va diciendo queda
 * aquí para releerlo, filtrado por expedición. */
import { K, V, docente } from '../guiones/estado.js';
import { partida, FASES, EXPEDICIONES } from './partida.js';

const elLog    = document.getElementById('log');
const elLogTitulo = document.getElementById('log-titulo');
const elLogTabs = document.getElementById('log-tabs');
const elLogIn  = document.getElementById('log-inner');
const elLogBtn = document.getElementById('log-btn');
const elBadge  = elLogBtn.querySelector('u');
const elEmpty  = document.getElementById('log-empty');

/* ------------------------------------------------------------- historial */
/* La burbuja solo habla por K-7. Lo que el docente elige o escribe no se le
   repite en pantalla: se guarda aquí, para poder releerlo cuando quiera. */

let pending = null;   // mensaje en pantalla; entra al historial al pasar
export let pendingWho = K;   // quién lo dijo (K-7 o la profe Vero)

export function addEntry(kind, html, quien) {
  const div = document.createElement('div');
  div.className = 'msg ' + kind;
  div.dataset.exp = String(partida.expActualIdx);   // para filtrar el historial por expedición
  if (kind === 'chapter') div.textContent = html;
  else div.innerHTML = `<span class="from">${kind === 'user' ? docente : (quien || K)}</span>` + html;
  elLogIn.appendChild(div);
  elEmpty.style.display = 'none';
  // el número junto al botón se reinicia con cada expedición (no cuenta lo
  // de expediciones anteriores, que sigue disponible en el historial): así
  // nunca se queda pegado en "99+"
  const n = elLogIn.querySelectorAll(`.msg[data-exp="${partida.expActualIdx}"]`).length;
  elBadge.textContent = n > 99 ? '99+' : String(n);
  if (elLog.classList.contains('on')) aplicarFiltroLog();   // log abierto: refleja el filtro ya elegido
}

/* Pestañas del historial: una por expedición empezada + "Todas", para no
   volcar todo lo hablado en un solo chat interminable. Solo tiene sentido
   distinguir si ya hay más de una expedición completada -con una sola no
   hay nada que separar-, así que se quedan ocultas hasta entonces. Cada
   `.msg` ya trae su `data-exp` (ver addEntry) desde que se creó. */
let filtroLog = 'todas';

// Nombre de la expedición activa, siempre visible arriba de las pestañas
// (incluso cuando todavía no hay pestañas que mostrar).
export function actualizarTituloLog() {
  elLogTitulo.textContent = FASES[partida.expActualIdx]?.[0]?.chapter || '';
}

export function actualizarTabsLog() {
  elLogTabs.innerHTML = '';
  // basta con haber EMPEZADO una segunda expedición para que tenga sentido
  // separar el historial en pestañas -antes exigía tener dos COMPLETADAS,
  // así que si la segunda expedición seguía en curso (lo normal, sea
  // avanzando o retomada a mitad tras un salto) las pestañas no aparecían
  // y todo el historial se veía junto, como si fuera una sola.
  if (partida.expedicionesEmpezadas.size <= 1) { elLogTabs.style.display = 'none'; return; }
  elLogTabs.style.display = '';
  [...partida.expedicionesEmpezadas].sort((a, b) => a - b).forEach((i) => {
    const b = document.createElement('button');
    b.className = 'log-tab';
    b.type = 'button';
    b.textContent = i < EXPEDICIONES.length ? `Expedición ${i + 1}` : 'Epílogo';
    b.dataset.exp = String(i);
    b.classList.toggle('activo', filtroLog === String(i));
    elLogTabs.appendChild(b);
  });
}

function filtrarLog(exp) {
  filtroLog = exp;
  for (const b of elLogTabs.children) b.classList.toggle('activo', b.dataset.exp === exp);
  aplicarFiltroLog();
}

function aplicarFiltroLog() {
  let algunaVisible = false;
  for (const el of elLogIn.querySelectorAll('.msg')) {
    const mostrar = filtroLog === 'todas' || el.dataset.exp === filtroLog;
    el.style.display = mostrar ? '' : 'none';
    algunaVisible = algunaVisible || mostrar;
  }
  elEmpty.style.display = algunaVisible ? 'none' : '';
}

// el mensaje actual entra al historial solo cuando deja de ser el actual
export function flushPending() {
  if (!pending) return;
  addEntry(pendingWho === V ? 'k7 vero' : 'k7', pending, pendingWho);
  pending = null;
}

// el mensaje que acaba de salir en la caja: entra al historial al pasar
// (ver flushPending)
export function ponerPendiente(texto, quien) {
  pending = texto;
  pendingWho = quien;
}

export const historialAbierto = () => elLog.classList.contains('on');

export function toggleLog(open) {
  const on = open ?? !elLog.classList.contains('on');
  elLog.classList.toggle('on', on);
  elLogBtn.setAttribute('aria-expanded', on);
  if (on) {
    actualizarTituloLog();
    actualizarTabsLog();
    // con pestañas visibles arranca en la expedición activa; sin pestañas
    // (nada que distinguir todavía) se ve todo el historial junto, porque
    // no hay tabs para separarlo
    filtrarLog(partida.expedicionesEmpezadas.size > 1 ? String(partida.expActualIdx) : 'todas');
    elLogIn.scrollTop = elLogIn.scrollHeight;   // lo último, primero a la vista
  }
}

// escucha del botón, de las pestañas y del panel (ver main.js)
export function iniciarHistorial() {
  elLogTabs.addEventListener('click', (e) => {
    const b = e.target.closest('.log-tab');
    if (b) filtrarLog(b.dataset.exp);
  });
  elLogBtn.addEventListener('click', () => toggleLog());
  elLog.addEventListener('click', (e) => {
    if (e.target.closest('.msg, .log-tab')) return;           // deja seleccionar texto o cambiar de pestaña
    toggleLog(false);                                        // un clic fuera lo cierra
  });
}

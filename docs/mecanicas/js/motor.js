/* Laboratorio de mecánicas · el motor del guion.
 *
 * Es una copia de apps/expedicion/js/motor.js (repo Montaje) que en esta
 * carpeta ocupa su lugar, con estos agregados, marcados con «NUEVO» más abajo:
 *
 *   rafaga:  ['texto', 'texto', …]   varios mensajes seguidos, un solo clic
 *   opción con `mas: [nodos]`         profundidad opcional («¿Me cuenta más?»)
 *   `sugerencias: [...]` en un input  frases que se tocan y se completan
 *   mecanica: async () => resultado   una mecánica jugable; el guion espera
 *   accion: async () => {}            un momento sin diálogo (pupitres, sellos…)
 *   chapter con `icono`, `color`, `lab`   la tarjeta de cada estación
 *   chapter con `resumen`                 su tarjeta en el menú de estaciones
 *   start() desde `lab.inicio`            entrar directo a una estación
 *
 * Todo lo demás (pizarra, ventana, Vero, historial, línea de tiempo) es el
 * comportamiento real, sin cambios. */
import { V, dicho, docente, setDocente } from '../guiones/estado.js';
import { k7, profesora, msPorFotograma } from './escena.js';
import {
  veroEnEscena, entrarProfesora, mostrarMochila, guardarMochila, reiniciarMochila,
  ponerProfesora, quitarProfesora, saltosProfe,
} from './elenco.js';
import { sincronizarDecoracion } from './aula.js';
import {
  pizarraActiva, pizarraAnimando, ventanaActiva, insigniaActiva, mensajeBajado,
  mostrarPizarra, ocultarPizarra, mostrarVentana, ocultarVentana, mostrarInsignia, ocultarInsignia,
  reiniciarInsignias, bajarMensaje, cerrarLupa, lupaAbierta,
} from './imagenes.js';
import {
  addEntry, flushPending, ponerPendiente, actualizarTituloLog, actualizarTabsLog,
  historialAbierto, toggleLog,
} from './historial.js';
import {
  cerrarPuertas, cerrarCortinas, abrirTransicionesEnSeco, cerrarPantallas, capituloAbierto,
  mostrarCapitulo, mostrarConclusion, resumenAbierto, cerrarConclusionLightbox,
  marcarTimeline, actualizarCandadosTimeline, revelarFaseEpilogo, actualizarProgresoTimeline,
} from './navegacion.js';
import { partida, EXPEDICIONES, FASES, TITULO_A_INDICE, script, inicioExpEnScript } from './partida.js';
import {
  lab, abortarMecanica, mecanicaActiva, entrarMecanica, salirMecanica, capaAbierta, estacionIniciada,
} from './lab.js';

const elText    = document.getElementById('text');
const elTag     = document.getElementById('nametag');
const elNext   = document.getElementById('next');
const elChoice = document.getElementById('choices');
const elForm   = document.getElementById('form');
const elEntry  = document.getElementById('entry');
const elSuger  = document.getElementById('sugerencias');   // NUEVO

let queue = [];
let nodoEnCurso = null;
let campoActivo = null;
let typing = null;
let full = '';
let waiting = false;
let esperandoLLM = false;
let reveal = null;
let pausaRafaga = null;   // NUEVO: temporizador entre mensajes de una ráfaga

function escapeText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const RITMO = 9;

/* La máquina de escribir de siempre, con un agregado: `destino` deja escribir
   dentro de un párrafo de la ráfaga en vez de sobre toda la caja. */
function typewrite(html, done, destino = elText) {
  cancelAnimationFrame(typing);
  // el final natural llama a `fin` directamente y no a `reveal`: la ráfaga
  // cambia `reveal` por "completar todo" mientras escribe cada mensaje
  const fin = () => { reveal = null; done(); };
  reveal = fin;
  const tokens = html.match(/<\/?[bi]>|[\s\S]/g) || [];

  destino.textContent = '';
  const vista  = document.createElement('span');
  const cursor = document.createElement('span');
  cursor.className = 'caret';
  destino.append(vista, cursor);

  let i = 0;
  let texto = '';
  let cierre = '';
  const porFotograma = Math.max(1, Math.min(3, Math.round(msPorFotograma / RITMO)));

  const step = () => {
    let salidas = 0;
    while (salidas < porFotograma && i < tokens.length) {
      const tk = tokens[i++];
      texto += tk;
      if (tk[0] === '<') {
        if (tk[1] === '/') cierre = cierre.replace(tk, '');
        else cierre = '</' + tk[1] + '>' + cierre;
      } else salidas++;
    }
    if (salidas) vista.innerHTML = texto + cierre;

    if (i >= tokens.length) {
      k7.hablar(false);
      profesora.hablar(false);
      destino.innerHTML = html;
      fin();
      return;
    }
    typing = requestAnimationFrame(step);
  };
  step();
}

function nameOf(node) {
  return typeof node.who === 'function' ? node.who() : node.who;
}

function clearUI() {
  elChoice.className = '';
  elChoice.innerHTML = '';
  elForm.className = '';
  elSuger.className = '';
  elSuger.innerHTML = '';
  elText.classList.remove('rafaga');
  elNext.classList.remove('on');
  clearTimeout(pausaRafaga);
  if (mensajeBajado) bajarMensaje(false);
  cancelAnimationFrame(typing);
  k7.hablar(false);
  k7.bocaEnReposo = 'feliz';
  profesora.hablar(false);
  profesora.bocaEnReposo = 'feliz';
  reveal = null;
  waiting = false;
}

export function irAExpedicion(idx) {
  const exp = FASES[idx];
  if (!exp) return;

  abortarMecanica();   // NUEVO: si se salta a mitad de una mecánica, se desarma
  cerrarPantallas();
  cerrarLupa();
  if (pizarraActiva) ocultarPizarra();
  if (ventanaActiva) ocultarVentana();

  abrirTransicionesEnSeco();
  partida.transicionCierre = 'puerta';
  queue = script.slice(inicioExpEnScript[idx]);
  next();
}

/* NUEVO · la tarjeta de cada estación: ícono, color y ficha de la mecánica.
   mostrarCapitulo() (el real) pone el ícono y el color por número de fase;
   aquí se corrigen después, porque la estación 2 también sale de la Exp. 1. */
function vestirCapitulo(node) {
  if (node.icono) document.getElementById('chapter-icon-img').src = node.icono;
  const btn = document.getElementById('chapter-btn');
  if (node.color) {
    btn.classList.remove('c1', 'c2', 'c3', 'c4', 'c5', 'c6');
    btn.classList.add(node.color);
  }
  const elLab = document.getElementById('chapter-lab');
  elLab.innerHTML = '';
  if (node.lab) {
    const { mecanica, duracion, prueba } = node.lab;
    elLab.innerHTML =
      `<span class="chip-lab">Mecánica · <b>${mecanica}</b></span>` +
      (duracion ? `<span class="chip-lab">${duracion}</span>` : '') +
      (prueba ? `<p>${prueba}</p>` : '');
  }
  document.getElementById('chapter-cta').hidden = true;
}

export async function next() {
  clearUI();
  flushPending();
  let node = queue.shift();
  if (!node) return;
  nodoEnCurso = node;

  if (node.conclusion) {
    actualizarProgresoTimeline(1);
    partida.fasesCompletadas.add(partida.expActualIdx);
    actualizarCandadosTimeline();
    actualizarTabsLog();
    if (partida.expActualIdx === EXPEDICIONES.length - 1) revelarFaseEpilogo();
    partida.transicionCierre = node.conclusion.transicion === 'cortina' ? 'cortina' : 'puerta';
    if (partida.transicionCierre === 'cortina') await cerrarCortinas();
    else await cerrarPuertas();
    quitarProfesora();
    mostrarConclusion(node.conclusion);
    return;
  }

  if (node.chapter) {
    abortarMecanica();   // NUEVO: lo que quedó de la estación anterior (pupitres, medidor) se va
    quitarProfesora();
    if (node.conVero) ponerProfesora();
    partida.expActualIdx = TITULO_A_INDICE.get(node.chapter);
    partida.totalNodosExp = Math.max(1, (FASES[partida.expActualIdx]?.length || 1) - 1);
    partida.nodosVistosExp = 0;
    marcarTimeline(partida.expActualIdx);
    actualizarProgresoTimeline(0);
    actualizarCandadosTimeline();
    reiniciarInsignias();
    reiniciarMochila();
    partida.expedicionesEmpezadas.add(partida.expActualIdx);
    actualizarTituloLog();
    actualizarTabsLog();
    addEntry('chapter', node.chapter);
    estacionIniciada(partida.expActualIdx);   // NUEVO: el menú y la URL siguen a la estación
    mostrarCapitulo(node, () => {
      sincronizarDecoracion(partida.expActualIdx, true);
      next();
    });
    vestirCapitulo(node);
    return;
  }

  if (node.finalizar) {
    await cerrarCortinas();
    location.href = node.finalizar;
    return;
  }

  if (node.end) {
    elTag.classList.add('hidden');
    full = '';
    elText.innerHTML = '<span style="opacity:.5">Fin del laboratorio.</span>';
    return;
  }

  /* NUEVO · un momento sin diálogo: se ejecuta y el guion sigue solo */
  if (node.accion) {
    document.body.classList.add('accion-on');   // la caja de diálogo se retira
    elText.innerHTML = '';
    await node.accion();
    if (node !== nodoEnCurso) return;
    document.body.classList.remove('accion-on');
    next();
    return;
  }
  document.body.classList.remove('accion-on');

  // una ráfaga puede calcular sus líneas con lo que el docente acaba de hacer
  if (typeof node.rafaga === 'function') {
    node = { ...node, rafaga: node.rafaga() };
    nodoEnCurso = node;
  }

  /* NUEVO · en el modo clásico, la ráfaga se desarma en mensajes sueltos:
     así se pueden comparar las dos formas con el mismo guion */
  if (node.rafaga && lab.ritmo === 'clasico') {
    const sueltos = node.rafaga.map((l, i) => {
      const linea = typeof l === 'string' ? { text: l } : { text: l.t, emote: l.emote };
      const n = { who: node.who, text: linea.text, emote: linea.emote || (i === 0 ? node.emote : undefined) };
      // lo que el nodo hace al final (pizarra, opciones…) va en el último
      if (i === node.rafaga.length - 1) {
        for (const k of ['board', 'boardHold', 'ventana', 'options', 'input', 'placeholder', 'sugerencias', 'mecanica', 'boton', 'campo', 'reaccion'])
          if (node[k] !== undefined) n[k] = node[k];
      }
      return n;
    });
    queue.unshift(...sueltos);
    next();
    return;
  }

  partida.nodosVistosExp++;
  actualizarProgresoTimeline();

  elTag.classList.remove('hidden');
  const quien = nameOf(node);
  elTag.textContent = quien;
  elTag.classList.toggle('vero', quien === V);

  const hablaVero = quien === V;

  if (node.dynamic) {
    if (hablaVero) { if (veroEnEscena) profesora.reproducir('Profesora_Escribiendo'); }
    else k7.reproducir('K7_Pensando');
    elText.innerHTML = '<span class="thinking"><span></span><span></span><span></span></span>';
    esperandoLLM = true;
    full = await node.dynamic();
    esperandoLLM = false;
    if (node !== nodoEnCurso) return;
  } else if (node.rafaga) {
    full = node.rafaga.map((l) => (typeof l === 'string' ? l : l.t)).join('\n\n');
  } else {
    full = node.text || '';
  }
  ponerPendiente(full, quien);

  k7.hablar(!hablaVero);
  if (veroEnEscena) profesora.hablar(hablaVero);

  const emoteName = typeof node.emote === 'function' ? node.emote() : node.emote;
  if (hablaVero) {
    if (veroEnEscena) profesora.reproducir(emoteName || 'Profesora_Idle');
    k7.reproducir(node.reaccion || 'Idle');
  } else {
    if (node.saltosLaterales) saltosProfe();
    else k7.reproducir(emoteName || 'Idle');
    if (veroEnEscena) profesora.reproducir('Profesora_Idle');
  }

  if (node.entra) entrarProfesora();
  if (node.gesto === 'mochila') mostrarMochila();
  if (node.insignia) mostrarInsignia(node.insignia);

  const alTerminar = () => {
    const enEspera = (node.input || node.options) ? 'pensando' : 'feliz';
    if (hablaVero) profesora.bocaEnReposo = enEspera;
    else k7.bocaEnReposo = enEspera;
    if (node.mecanica) {
      mostrarBotonMecanica(node);
    } else if (node.input) {
      campoActivo = node.input;
      elEntry.placeholder = node.placeholder || 'Escriba aquí su respuesta…';
      elForm.classList.add('on');
      if (node.sugerencias) mostrarSugerencias(node.sugerencias);
      elEntry.focus();
    } else if (node.options) {
      elChoice.classList.add('on');
      if (node.options.some((o) => o.mas)) elChoice.classList.add('con-mas');
      if (node.board) mostrarPizarra(node.board);
      for (const opt of node.options) {
        const b = document.createElement('button');
        b.className = 'choice' + (opt.mas ? ' choice-mas' : '');
        b.type = 'button';
        b.innerHTML = opt.mas
          ? `<span class="mas-signo">+</span>${escapeText(opt.label)}<span class="mas-tag">opcional</span>`
          : escapeText(opt.label);
        b.addEventListener('click', () => {
          flushPending();
          addEntry('user', escapeText(opt.label));
          // NUEVO: «¿Me cuenta más?» mete su tramo antes de seguir
          if (opt.mas) queue.unshift(...opt.mas);
          if (opt.reply) queue.unshift({ who: node.who, text: opt.reply });
          if (pizarraActiva) {
            const siguiente = queue[0];
            const sigueEnPizarra = siguiente && (siguiente.board || siguiente.boardHold);
            if (!sigueEnPizarra) { ocultarPizarra().then(next); return; }
          }
          next();
        });
        elChoice.appendChild(b);
      }
    } else {
      elNext.classList.add('on');
      waiting = true;
      if (node.board) mostrarPizarra(node.board);
      if (node.ventana) mostrarVentana(node.ventana);
    }
  };

  if (node.rafaga && !node.dynamic) escribirRafaga(node, alTerminar);
  else typewrite(full, alTerminar);
}

/* NUEVO · ráfaga: cada mensaje se escribe en su propio párrafo, con una pausa
   corta entre uno y otro, y los anteriores se quedan a la vista (atenuados).
   Un clic a mitad la completa entera; el siguiente clic ya avanza. */
function escribirRafaga(node, alTerminar) {
  const lineas = node.rafaga.map((l) => (typeof l === 'string' ? { t: l } : l));
  elText.innerHTML = '';
  elText.classList.add('rafaga');
  const parrafos = lineas.map(() => {
    const p = document.createElement('p');
    p.className = 'rafaga-linea';
    elText.appendChild(p);
    return p;
  });

  let i = 0;
  const terminarTodo = () => {
    clearTimeout(pausaRafaga);
    cancelAnimationFrame(typing);
    parrafos.forEach((p, j) => { p.innerHTML = lineas[j].t; p.classList.add('vista'); });
    parrafos.slice(0, -1).forEach((p) => p.classList.add('atras'));
    k7.hablar(false);
    reveal = null;
    alTerminar();
  };

  const escribir = () => {
    const p = parrafos[i];
    p.classList.add('vista');
    if (i > 0) parrafos[i - 1].classList.add('atras');
    if (lineas[i].emote) k7.reproducir(lineas[i].emote);
    k7.hablar(true);
    typewrite(lineas[i].t, () => {
      i++;
      if (i >= lineas.length) { reveal = null; alTerminar(); return; }
      k7.hablar(false);
      // mientras dura la pausa, un clic también completa la ráfaga
      reveal = terminarTodo;
      pausaRafaga = setTimeout(escribir, 520);
    }, p);
    // el clic a mitad de un mensaje completa toda la ráfaga, no solo ese
    reveal = terminarTodo;
  };
  escribir();
}

/* NUEVO · sugerencias de una pregunta abierta: se tocan, entran al campo y se
   completan. Quitan la página en blanco sin quitarle la palabra al docente. */
function mostrarSugerencias(lista) {
  elSuger.classList.add('on');
  elSuger.innerHTML = '<span class="suger-tit">Ideas para empezar:</span>';
  for (const s of lista) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'suger';
    b.textContent = s;
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const actual = elEntry.value.trim();
      elEntry.value = (actual ? actual + ' ' : '') + s.replace(/…$/, '').trim() + (s.endsWith('…') ? ' ' : '');
      elEntry.focus();
      elEntry.setSelectionRange(elEntry.value.length, elEntry.value.length);
      b.classList.add('usada');
    });
    elSuger.appendChild(b);
  }
}

/* NUEVO · la puerta de entrada a una mecánica: un botón grande y claro. Al
   pulsarlo, la caja de diálogo se retira, la mecánica toma la pantalla y el
   guion espera a que termine. Lo que devuelva queda en dicho[campo]. */
function mostrarBotonMecanica(node) {
  elChoice.classList.add('on', 'solo-mecanica');
  const b = document.createElement('button');
  b.className = 'choice choice-mecanica';
  b.type = 'button';
  b.innerHTML = `${escapeText(node.boton || 'Empezar')}<span class="flecha">→</span>`;
  b.addEventListener('click', async () => {
    flushPending();
    await correrMecanica(node);
  });
  elChoice.appendChild(b);
}

async function correrMecanica(node) {
  clearUI();
  entrarMecanica();
  const resultado = await node.mecanica();
  if (node !== nodoEnCurso) return;         // se saltó a otra estación a mitad
  salirMecanica();
  if (node.campo) dicho[node.campo] = resultado;
  next();
}

function advance() {
  if (mecanicaActiva() || capaAbierta()) return;   // NUEVO: la mecánica manda
  if (esperandoLLM) return;
  if (mensajeBajado) { bajarMensaje(false); return; }
  if (capituloAbierto()) return;
  if (elChoice.classList.contains('on') || elForm.classList.contains('on')) return;
  if (elText.querySelector('.caret') || (reveal && elText.classList.contains('rafaga'))) {
    cancelAnimationFrame(typing);
    k7.hablar(false);
    if (elText.classList.contains('rafaga')) { if (reveal) reveal(); return; }
    elText.innerHTML = full;
    if (reveal) reveal();
    return;
  }
  if (waiting) {
    if (pizarraAnimando) return;
    guardarMochila();
    if (ventanaActiva) { ocultarVentana(); next(); return; }
    const siguiente = queue[0];
    const sigueEnPizarra = siguiente && (siguiente.board || siguiente.boardHold);
    if (pizarraActiva && !sigueEnPizarra) { ocultarPizarra().then(next); return; }
    if (insigniaActiva && !(siguiente && siguiente.insignia)) {
      ocultarInsignia().then(next);
      return;
    }
    next();
  }
}

const NO_ES_NOMBRE = new Set([
  'no', 'si', 'sí', 'pues', 'bueno', 'la', 'el', 'mi', 'yo', 'nada', 'ninguno',
  'ninguna', 'gracias', 'hola', 'buenas', 'quiero', 'prefiero', 'este', 'esta',
  'creo', 'pienso', 'digamos', 'osea', 'o sea', 'tal', 'vez', 'aja', 'ajá',
  'eeeh', 'ehh', 'mmm', 'ok', 'okay', 'vale', 'nose', 'ns',
]);

function nombreDe(raw) {
  const declarado = /^\s*(hola|buenas|buenos d[ií]as|buenas tardes)[\s,.!¡]*/i.test(raw) ||
                     /(yo\s+)?(soy|me\s+llamo|mi\s+nombre\s+es|me\s+dicen)\s+/i.test(raw);
  const limpio = raw.replace(/^\s*(hola|buenas|buenos d[ií]as|buenas tardes)[\s,.!¡]*/i, '')
                    .replace(/^\s*(yo\s+)?(soy|me\s+llamo|mi\s+nombre\s+es|me\s+dicen)\s+/i, '');
  const palabras = limpio.split(/[\s,.;:]+/).filter(Boolean);
  const first = palabras[0];
  if (!first) return '';
  if (!declarado) {
    if (palabras.length > 4) return '';
    if (NO_ES_NOMBRE.has(first.toLowerCase())) return '';
  }
  if (!/^[a-záéíóúñü]+(-[a-záéíóúñü]+)?$/i.test(first)) return '';
  if (first.length < 2 || first.length > 20) return '';
  return escapeText(first.charAt(0).toUpperCase() + first.slice(1));
}

/* NUEVO · el guion arranca en la estación que se eligió en el menú (o en la
   URL, ?estacion=N) si se eligió antes de que el aula terminara de cargar */
export function start() {
  queue = script.slice(inicioExpEnScript[lab.inicio] ?? 0);
  lab.arrancado = true;
  next();
}

export function iniciarMotor() {
  addEventListener('click', (e) => {
    if (e.target.closest('#topbar, #log, #log-btn, .choice, #form, #peek-btn, #chapter, #conclusion, #conclusion-lightbox, #lupa, #timeline, #confirmar-salto, #sugerencias, #mec, #bienvenida, #final')) return;
    if (historialAbierto()) return;
    advance();
  });
  addEventListener('keydown', (e) => {
    if (mecanicaActiva() || capaAbierta()) return;   // NUEVO: el teclado es de la mecánica
    if (lupaAbierta()) { if (e.code === 'Escape') cerrarLupa(); return; }
    if (resumenAbierto()) { if (e.code === 'Escape') cerrarConclusionLightbox(); return; }
    if (e.code === 'Escape' && historialAbierto()) { toggleLog(false); return; }
    if (e.target === elEntry || historialAbierto()) return;
    if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); advance(); }
  });

  elForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = elEntry.value.trim();
    const limpio = escapeText(raw);
    if (campoActivo) dicho[campoActivo] = limpio;
    if (campoActivo === 'presentacion') setDocente(nombreDe(raw) || docente);
    campoActivo = null;
    elEntry.value = '';
    elEntry.blur();
    flushPending();
    if (raw) addEntry('user', limpio);
    next();
  });
}

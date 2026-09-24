/* Laboratorio de mecánicas · el grupo reacciona.
 *
 * Sobre las mesas reales del aula (las de implementos.glb que monta aula.js)
 * aparecen burbujas con lo que siente el grupo: duda, aburrimiento, una idea,
 * entusiasmo. Es la consecuencia vista en el mundo, no contada en un párrafo.
 * Arriba, un medidor de «conexión del grupo» sube o baja con la clase.
 *
 * Las burbujas son HTML que sigue en cada fotograma la proyección de cada
 * mesa, así que acompañan a la cámara si se mueve. */
import * as THREE from 'three';
import { scene, camera, esperar } from './escena.js';

const elCapa = document.getElementById('pupitres');
const elMedidor = document.getElementById('medidor');
const elBarra = elMedidor.querySelector('#medidor-barra i');
const elN = document.getElementById('medidor-n');

// qué se ve en cada estado: un ícono sencillo y su color
const ICONO = {
  duda: '<svg viewBox="0 0 24 24"><path d="M9.1 9a3 3 0 1 1 4.2 2.7c-.8.4-1.3 1.1-1.3 2v.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><circle cx="12" cy="18.2" r="1.5" fill="currentColor"/></svg>',
  aburrido: '<svg viewBox="0 0 24 24"><path d="M5 9h7l-7 8h7M14 5h5l-5 6h5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  idea: '<svg viewBox="0 0 24 24"><path d="M9 17h6M10 20.5h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
  participa: '<svg viewBox="0 0 24 24"><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11m0-6.5V4a1.5 1.5 0 0 1 3 0v7m0-5.5a1.5 1.5 0 0 1 3 0V12m0-3a1.5 1.5 0 0 1 3 0v5a7 7 0 0 1-7 7h-1.2a6 6 0 0 1-4.6-2.2L4 14.8a1.5 1.5 0 0 1 2.3-1.9L8 15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const ESTADOS = {
  duda:       { icono: ICONO.duda, clase: 'duda' },
  confusion:  { icono: ICONO.duda, clase: 'duda' },
  aburrido:   { icono: ICONO.aburrido, clase: 'aburrido' },
  idea:       { icono: ICONO.idea, clase: 'idea' },
  entusiasmo: { icono: ICONO.participa, clase: 'participa' },
};

let burbujas = [];   // { mesa, el, alto }
let siguiendo = false;
let porcentaje = 0;

function mesas() {
  const lista = [];
  scene.traverse((o) => { if (o.name === 'Mesa' && o.parent !== scene) lista.push(o); });
  return lista;
}

function seguir() {
  if (!burbujas.length) { siguiendo = false; return; }
  const p = new THREE.Vector3();
  for (const b of burbujas) {
    b.mesa.getWorldPosition(p);
    p.y += b.alto;
    p.project(camera);
    const x = (p.x * 0.5 + 0.5) * innerWidth;
    const y = (1 - (p.y * 0.5 + 0.5)) * innerHeight;
    const fuera = p.z > 1 || x < 20 || x > innerWidth - 20 || y < 60 || y > innerHeight - 40;
    b.el.style.transform = `translate(${x}px, ${y}px)`;
    b.el.classList.toggle('fuera', fuera);
  }
  requestAnimationFrame(seguir);
}

/* Pone una burbuja por mesa, de a una (con su «pop»). `estados` puede ser un
   solo estado para todas o una lista, una por mesa. */
export async function reaccionar(estados, { pausa = 260 } = {}) {
  quitarBurbujas();
  const lista = mesas();
  if (!lista.length) return;
  const cada = Array.isArray(estados) ? estados : lista.map(() => estados);
  for (let i = 0; i < lista.length; i++) {
    const e = ESTADOS[cada[i % cada.length]] || ESTADOS.duda;
    const el = document.createElement('div');
    el.className = 'pupitre-burbuja ' + e.clase;
    el.innerHTML = `<span>${e.icono}</span>`;
    elCapa.appendChild(el);
    burbujas.push({ mesa: lista[i], el, alto: 1.32 + (i % 2) * 0.16 });
    if (!siguiendo) { siguiendo = true; requestAnimationFrame(seguir); }
    requestAnimationFrame(() => el.classList.add('on'));
    await esperar(pausa);
  }
}

export function quitarBurbujas() {
  for (const b of burbujas) b.el.remove();
  burbujas = [];
}

/* ---------------------------------------------------------- medidor --- */

export function mostrarMedidor(titulo = 'Conexión del grupo', desde = 0) {
  document.getElementById('medidor-titulo').textContent = titulo;
  porcentaje = desde;
  pintar(desde);
  elMedidor.classList.add('on');
}

function pintar(v) {
  elBarra.style.width = v + '%';
  elN.textContent = Math.round(v) + '%';
  elMedidor.dataset.nivel = v < 35 ? 'bajo' : v < 70 ? 'medio' : 'alto';
}

export function medidorA(hasta, ms = 1400) {
  return new Promise((resolve) => {
    const desde = porcentaje;
    const t0 = performance.now();
    (function paso(ahora) {
      const t = Math.min(1, (ahora - t0) / ms);
      const e = 1 - (1 - t) ** 3;
      porcentaje = desde + (hasta - desde) * e;
      pintar(porcentaje);
      if (t < 1) requestAnimationFrame(paso);
      else resolve();
    })(t0);
  });
}

export function ocultarMedidor() {
  elMedidor.classList.remove('on');
}

export function apagarGrupo() {
  quitarBurbujas();
  ocultarMedidor();
}

addEventListener('lab:abortar', apagarGrupo);

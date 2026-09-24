/* Mecánica · Marcar problemas.
 *
 * Una imagen real de la expedición se abre en la ventana, con la cámara
 * frente al tablero. El docente la toca donde ve un problema: la zona queda
 * enmarcada con un número discreto y el hallazgo se anota en la lista de al
 * lado, con su explicación. Tocar algo que está bien no penaliza: K-7 lo
 * comenta en el pie. Una cita de K-7 (lo que dijo antes) puede quedar a la
 * vista para poder contrastarla con la imagen.
 *
 *   marcar({ img, ancho, alto, zonas, senuelos, ... }) → { hallados, total, segundos }
 *
 * Zonas en % de la imagen: [x, y, ancho, alto]. */
import {
  ventana, k7Dice, mano, alSalir, camaraTablero, camaraNormal, esperar,
} from '../lab.js';

export function marcar(op) {
  const {
    estacion, color = 'c1', titulo, instruccion, cita = '',
    img, ancho, alto, zonas, senuelos = [], alFallar = [], alCompletar = '', saludo = '',
  } = op;

  return new Promise(async (resolve) => {
    const hallados = [];
    const t0 = performance.now();
    let fallos = 0;

    await camaraTablero();
    const v = ventana({ estacion, color, titulo, instruccion, ancho: 'amplia' });
    v.cuerpo.innerHTML = `
      <div class="mar">
        <div class="mar-izq">
          ${cita ? `<div class="mar-cita"><span>K-7 dijo</span><p>${cita}</p></div>` : ''}
          <div class="mar-lienzo" style="aspect-ratio:${ancho}/${alto}">
            <img src="${img}" alt="" draggable="false">
            <div class="mar-marcas"></div>
          </div>
        </div>
        <aside class="mar-lista">
          <p class="lista-tit">Lo que encontró</p>
          <ol>${zonas.map((_, i) => `<li class="pendiente"><span class="num">${i + 1}</span><div><b>Por encontrar</b></div></li>`).join('')}</ol>
        </aside>
      </div>`;
    const lienzo = v.cuerpo.querySelector('.mar-lienzo');
    const marcas = v.cuerpo.querySelector('.mar-marcas');
    const items = [...v.cuerpo.querySelectorAll('.mar-lista li')];
    const acc = v.acciones('<button type="button" class="btn btn-pri" data-a="seguir" disabled>Continuar</button>');
    const btn = acc.querySelector('button');
    v.progreso(0, zonas.length);
    if (saludo) k7Dice(saludo, { emote: 'K7_Pensando' });

    v.pista(() => {
      const falta = zonas.find((z) => !hallados.includes(z.id));
      if (!falta) return;
      marca(falta.rects[0], 'pista');
      k7Dice(falta.pista, { emote: 'K7_Pensando' });
    });

    await esperar(500);
    mano(lienzo);

    /* ------------------------------------------------------- dibujo --- */

    // unos 12 px de margen alrededor de cada zona, sea cual sea el tamaño
    const margen = () => (12 / lienzo.getBoundingClientRect().width) * 100;
    const dentro = (x, y, [rx, ry, rw, rh]) => {
      const t = margen();
      return x >= rx - t && x <= rx + rw + t && y >= ry - t && y <= ry + rh + t;
    };

    function marca([x, y, w, h], clase, numero) {
      const m = document.createElement('div');
      m.className = 'mar-marca ' + clase;
      Object.assign(m.style, { left: x + '%', top: y + '%', width: w + '%', height: h + '%' });
      if (numero) m.innerHTML = `<span>${numero}</span>`;
      marcas.appendChild(m);
      if (clase === 'pista') setTimeout(() => m.remove(), 2400);
    }

    function onda(x, y) {
      const o = document.createElement('div');
      o.className = 'mar-onda';
      o.style.left = x + '%';
      o.style.top = y + '%';
      marcas.appendChild(o);
      setTimeout(() => o.remove(), 600);
    }

    /* ------------------------------------------------------- toques --- */

    lienzo.addEventListener('pointerdown', (e) => {
      const r = lienzo.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * 100;
      const y = ((e.clientY - r.top) / r.height) * 100;

      const z = zonas.find((zz) => zz.rects.some((rc) => dentro(x, y, rc)));
      if (z) {
        if (hallados.includes(z.id)) return;
        hallados.push(z.id);
        const n = hallados.length;
        // se enmarca solo la zona principal: las demás siguen siendo tocables,
        // pero marcarlas todas llenaba la imagen de líneas
        marca(z.rects[0], 'hallada', n);
        const li = items[n - 1];
        li.className = 'hallado';
        li.innerHTML = `<span class="num">${n}</span><div><b>${z.etiqueta}</b><span>${z.detalle}</span></div>`;
        v.progreso(n, zonas.length);
        k7Dice(z.k7, { emote: z.emote || 'K7_Pensando' });
        if (n === zonas.length) terminar();
        return;
      }
      onda(x, y);
      const s = senuelos.find((ss) => ss.rects.some((rc) => dentro(x, y, rc)));
      if (s) { k7Dice(s.k7, { emote: 'K7_HighFive' }); return; }
      fallos++;
      if (alFallar.length && fallos % 3 === 0) k7Dice(alFallar[(fallos / 3 - 1) % alFallar.length], { emote: 'K7_Pensando' });
    });

    function terminar() {
      btn.disabled = false;
      v.pista(null);
      v.instruccion('Encontró todos los problemas.');
      setTimeout(() => k7Dice(alCompletar, { emote: 'K7_Saltito' }), 1600);
    }

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await v.cerrar();
      await camaraNormal();
      resolve({ hallados, total: zonas.length, segundos: Math.round((performance.now() - t0) / 1000) });
    });
  });
}

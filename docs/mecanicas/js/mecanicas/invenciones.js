/* Mecánica · Cazar invenciones.
 *
 * El trabajo de K-7 sobre la Batalla de Boyacá (Expedición 3) se abre en una
 * ventana amplia, con la cámara frente al tablero: a la izquierda la
 * ilustración que K-7 generó y la lista de lo encontrado; a la derecha el
 * texto. Hay cinco invenciones mezcladas con hechos reales. El docente toca lo
 * que cree inventado: si lo es, queda tachado con un número y la corrección
 * se anota en la lista (no dentro del texto, para no ensuciarlo). Si era
 * cierto, queda subrayado como verificado y K-7 lo confirma en el pie.
 *
 *   cazarInvenciones() → { halladas, total, verificados, segundos } */
import { ventana, k7Dice, camaraTablero, camaraNormal } from '../lab.js';

const FRAGMENTOS = {
  f20julio: { inventado: true, titulo: 'La fecha', dato: 'Fue el 7 de agosto de 1819. El 20 de julio es de 1810.',
    pista: 'Revise la fecha: ¿cuándo fue la Batalla de Boyacá?', k7: 'Mezclé dos fechas patrias: en mis datos suenan parecido.' },
  campana: { dato: 'Sí: así se llamó la campaña de 1819.' },
  bolivar: { dato: 'Sí: Bolívar dirigió la Campaña Libertadora.' },
  legion: { inventado: true, titulo: 'La legión romana', dato: 'En 1819 no existía el Imperio romano.',
    pista: '¿Qué hace un general romano en el siglo XIX?', k7: 'Romanos en 1819… y lo escribí con total seguridad.' },
  elefantes: { inventado: true, titulo: 'Los elefantes', dato: 'Ningún ejército usó elefantes en esta campaña.',
    pista: 'Piense en los animales del relato.', k7: 'Elefantes en los Andes. Mis cálculos no sienten el frío del páramo.' },
  muiscas: { inventado: true, titulo: 'Los guerreros muiscas', dato: 'La Confederación Muisca había desaparecido casi 300 años antes.',
    pista: '¿Qué pueblo aparece en una época que no es la suya?', k7: 'Combiné fragmentos de siglos distintos. Eso es alucinar.' },
  santander: { dato: 'Sí: Santander comandó la vanguardia patriota.' },
  puente: { dato: 'Sí: la batalla ocurrió junto al puente, cerca de Tunja.' },
  realistas: { dato: 'Sí: el ejército realista estaba al mando de José María Barreiro.' },
  cita: { inventado: true, titulo: 'La cita del historiador', dato: 'Ni ese historiador ni ese libro existen.',
    pista: 'Desconfíe de las citas que suenan muy académicas.', k7: 'La cita la inventé completa. Hasta el año.' },
};

const TEXTO = `
  El <f id="f20julio">20 de julio de 1819</f>, durante <f id="campana">la Campaña Libertadora de la Nueva Granada</f>,
  <f id="bolivar">Simón Bolívar</f> selló un pacto estratégico con <f id="legion">la Duodécima Legión del general romano Marco Aurelio</f>.
  Gracias a <f id="elefantes">una tropa de elefantes de combate adaptados a los Andes</f> y a
  <f id="muiscas">los guerreros muiscas, que cabalgaban junto a Bolívar</f>, las tropas patriotas
  —con <f id="santander">Francisco de Paula Santander</f> al frente de la vanguardia— rompieron el cerco en
  <f id="puente">el Puente de Boyacá</f> y vencieron a <f id="realistas">las tropas realistas de la corona española</f>.
  <f id="cita">Según el historiador francés Jean-Luc Moreau, en su tratado «Elefantes y libertad» (1904)</f>,
  fue «la maniobra más audaz del siglo».`;

export function cazarInvenciones() {
  return new Promise(async (resolve) => {
    const total = Object.values(FRAGMENTOS).filter((f) => f.inventado).length;
    const halladas = [];
    const verificados = new Set();
    const t0 = performance.now();

    await camaraTablero();
    const v = ventana({
      estacion: 'Estación 4 · Cazar invenciones', color: 'c3',
      titulo: 'El trabajo de K-7 sobre la Batalla de Boyacá',
      instruccion: 'Está bien escrito, pero tiene cinco cosas que nunca pasaron. Toque en el texto lo que crea inventado.',
    });

    const html = TEXTO.replace(/<f id="(\w+)">/g, '<span class="inv-frag" data-f="$1" tabindex="0" role="button">').replace(/<\/f>/g, '</span>');
    v.cuerpo.innerHTML = `
      <div class="inv">
        <figure class="inv-fig">
          <img src="img/exp3/actividad3-1.webp" alt="Ilustración de K-7: la Batalla de Boyacá con romanos, elefantes y guerreros muiscas">
          <figcaption>Ilustración que K-7 generó para su trabajo</figcaption>
        </figure>
        <article class="inv-doc">
          <p class="inv-kicker">Ciencias Sociales · trabajo de K-7</p>
          <h3>La batalla decisiva de 1819 y la alianza muisca-romana</h3>
          <p class="inv-texto">${html}</p>
        </article>
        <div class="inv-lista">
          <p class="lista-tit">Lo que encontró</p>
          <ol>${Array.from({ length: total }, (_, k) => `<li class="pendiente"><span class="num">${k + 1}</span><div><b>Por encontrar</b></div></li>`).join('')}</ol>
        </div>
      </div>`;
    const items = [...v.cuerpo.querySelectorAll('.inv-lista li')];
    const acc = v.acciones('<button type="button" class="btn btn-pri" data-a="seguir" disabled>Continuar</button>');
    const btn = acc.querySelector('button');
    v.progreso(0, total, `0 de ${total}`);
    k7Dice('Crucé millones de fuentes. Lo veo <b>todo bien</b>.', { emote: 'K7_Pensando' });

    v.pista(() => {
      const id = Object.keys(FRAGMENTOS).find((k) => FRAGMENTOS[k].inventado && !halladas.includes(k));
      if (!id) return;
      const el = v.cuerpo.querySelector(`[data-f=${id}]`);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.remove('brilla'); void el.offsetWidth; el.classList.add('brilla');
      k7Dice(FRAGMENTOS[id].pista, { emote: 'K7_Pensando' });
    });

    const tocar = (el) => {
      const id = el.dataset.f;
      const f = FRAGMENTOS[id];
      if (halladas.includes(id) || verificados.has(id)) return;

      if (f.inventado) {
        halladas.push(id);
        const n = halladas.length;
        el.classList.add('inventado');
        el.insertAdjacentHTML('beforeend', `<sup>${n}</sup>`);
        const li = items[n - 1];
        li.className = 'hallado';
        li.innerHTML = `<span class="num">${n}</span><div><b>${f.titulo}</b><span>${f.dato}</span></div>`;
        v.progreso(n, total, `${n} de ${total}`);
        k7Dice(f.k7, { emote: 'K7_Triste' });
        if (n === total) terminar();
      } else {
        verificados.add(id);
        el.classList.add('verificado');
        k7Dice(`Eso sí es cierto. ${f.dato.replace(/^Sí: /, '')}`, { emote: 'K7_HighFive' });
      }
    };

    const texto = v.cuerpo.querySelector('.inv-texto');
    texto.addEventListener('click', (e) => {
      const el = e.target.closest('.inv-frag');
      if (!el) return;
      e.stopPropagation();
      tocar(el);
    });
    texto.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('inv-frag')) { e.preventDefault(); tocar(e.target); }
    });

    function terminar() {
      btn.disabled = false;
      v.pista(null);
      v.instruccion('Encontró las cinco invenciones. Bien escrito no es lo mismo que verdadero.');
      setTimeout(() => k7Dice('Las cinco. Y yo que lo veía <b>todo bien</b>…', { emote: 'K7_Saltito' }), 1800);
    }

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await v.cerrar();
      await camaraNormal();
      resolve({ halladas: halladas.length, total, verificados: verificados.size, segundos: Math.round((performance.now() - t0) / 1000) });
    });
  });
}

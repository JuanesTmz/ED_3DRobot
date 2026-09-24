/* Mecánica · Armar el contexto.
 *
 * Dos tiempos, en la misma ventana:
 *   1. PASO A PASO: cinco preguntas cortas (grado, situación, medidas,
 *      materiales, forma de trabajo), una por pantalla, con opciones claras.
 *      A la derecha, el resumen de «lo que K-7 sabrá de su salón» se va
 *      llenando; tocar un dato del resumen vuelve a esa pregunta. La última
 *      admite, opcional, algo más que solo el docente sabe de su grupo.
 *   2. LA GUÍA REESCRITA: la guía original de K-7 aparece y cada línea se
 *      reescribe con lo elegido, resaltado. Es el «antes y después».
 * Después, el guion lleva la guía a probar con el grupo (los pupitres).
 *
 *   armarContexto() → { grado, lugar, medida, recursos, como, nota, lugarTxt } */
import { ventana, k7Dice, alSalir, camaraTablero, camaraNormal, esperar, escapar } from '../lab.js';

const PASOS = [
  { id: 'grado', dato: 'Grado', pregunta: '¿Para qué grado es la guía?',
    ayuda: 'K-7 le dijo «quinto» y la guía decía «séptimo». Usted decide.', cols: 4, opciones: [
      { id: '4', txt: '4°' }, { id: '5', txt: '5°' }, { id: '6', txt: '6°' }, { id: '7', txt: '7°' },
    ] },
  { id: 'lugar', dato: 'Situación', pregunta: '¿En qué situación cotidiana pasa el problema?',
    ayuda: 'Algo que sus estudiantes vivan de verdad.', opciones: [
      { id: 'metro', txt: 'El Metro de Medellín', desc: 'Viajes, estaciones, trenes', k7: 'El Metro: eso sí lo conocen todos sus estudiantes.' },
      { id: 'tienda', txt: 'La tienda del barrio', desc: 'Compras, precios, vueltas', k7: 'La tienda del barrio: fracciones con pan y con fiado.' },
      { id: 'cancha', txt: 'La cancha de la cuadra', desc: 'Equipos, tiempos, torneos', k7: 'La cancha: ahí se reparten minutos, goles y equipos.' },
    ] },
  { id: 'medida', dato: 'Medidas', pregunta: '¿Con qué medidas trabajan sus estudiantes?',
    ayuda: 'En la guía de K-7 todo estaba en millas y dólares.', opciones: [
      { id: 'cuadras', txt: 'Cuadras y minutos', desc: 'Distancias y tiempos del barrio', k7: 'Cuadras y minutos: así se mide en el barrio.' },
      { id: 'pesos', txt: 'Pesos colombianos', desc: 'Precios y dinero', k7: 'Pesos: fracciones con plata de verdad.' },
    ] },
  { id: 'recursos', dato: 'Materiales', pregunta: '¿Con qué materiales cuentan en clase?',
    ayuda: 'La guía tiene que poder hacerse con lo que hay a mano.', opciones: [
      { id: 'cuaderno', txt: 'Cuaderno y lápiz', desc: 'Sin necesidad de conexión', k7: 'Cuaderno y lápiz. Anotado.' },
      { id: 'celular', txt: 'Un celular por grupo', desc: 'Para calcular o consultar', k7: 'Un celular por grupo: además los pone a conversar.' },
      { id: 'material', txt: 'Material del salón', desc: 'Tapas, cartón, regletas', k7: 'Material del salón: fracciones que se pueden tocar.' },
    ] },
  { id: 'como', dato: 'Forma de trabajo', pregunta: '¿Cómo trabajan mejor?',
    ayuda: 'Y, si quiere, algo más que K-7 deba saber de su grupo.', opciones: [
      { id: 'parejas', txt: 'En parejas', desc: 'Uno resuelve, el otro comprueba', k7: 'En parejas: uno explica y el otro comprueba.' },
      { id: 'grupo', txt: 'Todo el grupo', desc: 'En voz alta, en el tablero', k7: 'Todo el grupo, en voz alta: nadie se queda por fuera.' },
      { id: 'estaciones', txt: 'Por estaciones', desc: 'Rotan por mesas de trabajo', k7: 'Por estaciones: se mueven, y la clase respira.' },
    ] },
];

const SUGERENCIAS_NOTA = ['Les encanta el fútbol', 'Muchos ayudan en el negocio de la familia', 'Les cuesta leer problemas largos'];

/* ------------------------------------------------- la guía, reescrita --- */

const LUGAR = {
  metro: {
    aplicacion: 'el Metro de Medellín',
    p1: { cuadras: 'Para llegar al colegio, Mateo recorre <em>457 cuadras</em> al mes, y 3/4 las hace en <em>Metro</em>. ¿Cuántas cuadras hace en Metro?',
          pesos: 'Una familia gasta <em>457 mil pesos</em> al año en pasajes del <em>Metro</em>, y 3/4 son viajes al colegio. ¿Cuánto dinero es eso?' },
    p2: 'De los 28 trenes del <em>Metro</em> que salen en la mañana, 1/2 va hacia Niquía. ¿Cuántos son?',
  },
  tienda: {
    aplicacion: 'la tienda del barrio',
    p1: { cuadras: 'El domiciliario de la <em>tienda</em> recorre <em>457 cuadras</em> al mes, y 3/4 son de subida. ¿Cuántas cuadras sube?',
          pesos: 'La <em>tienda</em> vendió <em>457 mil pesos</em> el sábado, y 3/4 fue en frutas. ¿Cuánto dinero fue en frutas?' },
    p2: 'Doña Rosa recibe 28 panes a las 6 a. m., y a las 7 ya vendió 1/2. ¿Cuántos panes vendió?',
  },
  cancha: {
    aplicacion: 'la cancha de la cuadra',
    p1: { cuadras: 'El equipo trota <em>457 cuadras</em> en el mes, y 3/4 son alrededor de la <em>cancha</em>. ¿Cuántas cuadras le da a la cancha?',
          pesos: 'El torneo de la <em>cancha</em> recogió <em>457 mil pesos</em>, y 3/4 se usó en balones. ¿Cuánto costaron los balones?' },
    p2: 'En el torneo de la <em>cancha</em> juegan 28 niños, y 1/2 son del colegio. ¿Cuántos son del colegio?',
  },
};
const RECURSOS = { cuaderno: 'cuaderno y lápiz', celular: 'un celular por grupo', material: 'material del salón (tapas, cartón, regletas)' };
const COMO = { parejas: 'en parejas: uno resuelve y el otro comprueba', grupo: 'con todo el grupo, en voz alta', estaciones: 'por estaciones, rotando cada 10 minutos' };

// la guía tal como la hizo K-7 (la de la imagen de la Expedición 1)
const ORIGINAL = {
  grado: 'Guía de matemáticas · 7° grado',
  lugar: 'Aplicación: trenes de alta velocidad de EE. UU.',
  p1: 'El Corredor del Nordeste de Amtrak tiene 3/4 electrificado. Si mide 457 millas, ¿cuántas millas no lo están?',
  p2: 'De la flota Acela Express, 1/2 está en servicio. Si hay 28 trenes, ¿cuántos están en servicio?',
  recursos: 'Materiales: los que indique el libro de texto',
  como: 'Forma de trabajo: individual, en silencio',
};

function reescrita(e) {
  const L = LUGAR[e.lugar];
  return {
    grado: `Guía de matemáticas · <em>${e.grado}° grado</em>`,
    lugar: `Aplicación: <em>${L.aplicacion}</em>`,
    p1: L.p1[e.medida === 'pesos' ? 'pesos' : 'cuadras'],
    p2: L.p2,
    recursos: `Materiales: <em>${RECURSOS[e.recursos]}</em>`,
    como: `Forma de trabajo: <em>${COMO[e.como]}</em>`,
  };
}

/* ============================================================ mecánica */

export function armarContexto() {
  return new Promise(async (resolve) => {
    const eleccion = {};
    let nota = '';
    let paso = 0;

    await camaraTablero();
    const v = ventana({
      estacion: 'Estación 2 · Armar el contexto', color: 'c1',
      titulo: 'Dele a K-7 el contexto de su salón',
      instruccion: 'Cinco preguntas cortas. Con sus respuestas, K-7 reescribirá la guía de trenes.',
    });

    v.cuerpo.innerHTML = `
      <div class="ctx">
        <div class="ctx-paso"></div>
        <aside class="ctx-resumen">
          <p class="lista-tit">Lo que K-7 sabrá de su salón</p>
          <dl>${PASOS.map((p, i) => `
            <div class="ctx-dato" data-i="${i}"><dt>${p.dato}</dt><dd>—</dd></div>`).join('')}
            <div class="ctx-dato nota" hidden><dt>Además</dt><dd></dd></div>
          </dl>
        </aside>
      </div>`;
    const elPaso = v.cuerpo.querySelector('.ctx-paso');
    const acc = v.acciones(`
      <button type="button" class="btn btn-sec" data-a="atras">Anterior</button>
      <button type="button" class="btn btn-pri" data-a="siguiente" disabled>Siguiente</button>`);
    const btnAtras = acc.querySelector('[data-a=atras]');
    const btnSig = acc.querySelector('[data-a=siguiente]');
    k7Dice('Esta vez, antes de diseñar nada, <b>le pregunto a usted</b>.');

    function pintarPaso() {
      const p = PASOS[paso];
      const ultimo = paso === PASOS.length - 1;
      elPaso.innerHTML = `
        <h3 class="ctx-preg">${p.pregunta}</h3>
        <p class="ctx-ayuda">${p.ayuda}</p>
        <div class="ctx-opciones ${p.cols === 4 ? 'cuatro' : ''}">
          ${p.opciones.map((o) => `
            <button type="button" class="ctx-op ${eleccion[p.id] === o.id ? 'elegida' : ''}" data-o="${o.id}">
              <span class="ctx-op-marca"></span>
              <span class="ctx-op-txt"><b>${o.txt}</b>${o.desc ? `<small>${o.desc}</small>` : ''}</span>
            </button>`).join('')}
        </div>
        ${ultimo ? `
          <div class="ctx-nota">
            <label for="ctx-nota">Algo más que K-7 deba saber de su grupo <small>(opcional)</small></label>
            <input id="ctx-nota" maxlength="90" value="${escapar(nota)}" placeholder="Por ejemplo: les encanta el fútbol">
            <div class="sugerencias">${SUGERENCIAS_NOTA.map((s) => `<button type="button" class="sug">${s}</button>`).join('')}</div>
          </div>` : ''}`;
      elPaso.animate([{ opacity: 0, transform: 'translateX(12px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: 'ease-out' });
      v.progreso(paso + 1, PASOS.length, `Paso ${paso + 1} de ${PASOS.length}`);
      btnAtras.hidden = paso === 0;
      btnSig.textContent = ultimo ? 'Reescribir la guía' : 'Siguiente';
      btnSig.disabled = !eleccion[p.id];
      v.cuerpo.querySelectorAll('.ctx-dato').forEach((d) => d.classList.toggle('actual', Number(d.dataset.i) === paso));
      if (ultimo) {
        const input = elPaso.querySelector('#ctx-nota');
        input.addEventListener('input', () => { nota = input.value.trim(); pintarResumen(); });
        input.addEventListener('click', (e) => e.stopPropagation());
        elPaso.querySelector('.sugerencias').addEventListener('click', (e) => {
          const s = e.target.closest('.sug');
          if (!s) return;
          e.stopPropagation();
          input.value = s.textContent;
          nota = s.textContent;
          pintarResumen();
          k7Dice(`«${escapar(nota)}». Eso no está en ningún repositorio.`, { emote: 'K7_HighFive' });
        });
      }
    }

    function pintarResumen() {
      PASOS.forEach((p, i) => {
        const d = v.cuerpo.querySelector(`.ctx-dato[data-i="${i}"]`);
        const o = p.opciones.find((oo) => oo.id === eleccion[p.id]);
        d.querySelector('dd').textContent = o ? (p.id === 'grado' ? `${o.txt} grado` : o.txt) : '—';
        d.classList.toggle('lleno', !!o);
      });
      const n = v.cuerpo.querySelector('.ctx-dato.nota');
      n.hidden = !nota;
      n.querySelector('dd').textContent = nota;
    }

    elPaso.addEventListener('click', (e) => {
      const b = e.target.closest('.ctx-op');
      if (!b) return;
      e.stopPropagation();
      const p = PASOS[paso];
      const o = p.opciones.find((oo) => oo.id === b.dataset.o);
      eleccion[p.id] = o.id;
      elPaso.querySelectorAll('.ctx-op').forEach((x) => x.classList.toggle('elegida', x === b));
      btnSig.disabled = false;
      pintarResumen();
      k7Dice(p.id === 'grado' ? `<b>${o.txt} grado</b>. Esta vez no me lo invento.` : o.k7, { emote: 'K7_HighFive' });
    });

    // el resumen también navega: tocar un dato vuelve a esa pregunta
    v.cuerpo.querySelector('.ctx-resumen').addEventListener('click', (e) => {
      const d = e.target.closest('.ctx-dato[data-i]');
      if (!d) return;
      e.stopPropagation();
      const i = Number(d.dataset.i);
      if (i > paso && !PASOS.slice(0, i).every((p) => eleccion[p.id])) return;
      paso = i;
      pintarPaso();
    });

    acc.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b || b.disabled) return;
      e.stopPropagation();
      if (b.dataset.a === 'atras') { paso = Math.max(0, paso - 1); pintarPaso(); return; }
      if (paso < PASOS.length - 1) { paso++; pintarPaso(); return; }
      await reescribir({ ...eleccion, nota });
    });

    const teclas = (e) => {
      if (e.key === 'Enter' && !btnSig.disabled && e.target.id !== 'ctx-nota') btnSig.click();
    };
    addEventListener('keydown', teclas);
    alSalir(() => removeEventListener('keydown', teclas));

    pintarPaso();

    /* --------------------------------------------- la guía reescrita --- */

    async function reescribir(e) {
      removeEventListener('keydown', teclas);
      const nueva = reescrita(e);
      v.titulo('La guía, con su contexto');
      v.instruccion('Cada línea se reescribe con lo que usted eligió. Lo resaltado es su aporte.');
      v.progreso(1, 1, '');
      const lineas = Object.keys(ORIGINAL);
      v.cuerpo.innerHTML = `
        <article class="guia">
          ${lineas.map((k) => `<p class="guia-linea guia-${k}" data-k="${k}"><span>${ORIGINAL[k]}</span></p>`).join('')}
          ${e.nota ? `<p class="guia-linea guia-nota"><span>Para tener en cuenta: <em>${escapar(e.nota)}</em></span></p>` : ''}
        </article>`;
      v.acciones('<button type="button" class="btn btn-pri" data-a="probar" disabled>Probarla con el grupo</button>');
      k7Dice('Esta era mi guía. Ahora, con lo que usted me dijo…', { emote: 'K7_Pensando' });
      await esperar(1500);

      for (const k of lineas) {
        const l = v.cuerpo.querySelector(`[data-k="${k}"]`);
        l.classList.add('cambiando');
        await esperar(220);
        l.querySelector('span').innerHTML = nueva[k];
        l.classList.remove('cambiando');
        l.classList.add('nueva');
        await esperar(380);
      }
      const nl = v.cuerpo.querySelector('.guia-nota');
      if (nl) nl.classList.add('nueva');

      k7Dice('Mismas fracciones, mismas cifras. <b>Otro salón.</b> ¿La probamos con el grupo?', { emote: 'K7_Saltito' });
      const btn = v.el.querySelector('[data-a=probar]');
      btn.disabled = false;
      btn.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await v.cerrar();
        await camaraNormal();
        resolve({ ...e, lugarTxt: LUGAR[e.lugar].aplicacion });
      }, { once: true });
    }
  });
}

/* Mecánica · Usar, ajustar o descartar.
 *
 * K-7 propone siete actividades (las piezas de «La familia campeona» de la
 * Expedición 2, más otras) y el docente decide sobre cada una, de a una:
 * USARLA tal como está, AJUSTARLA o DESCARTARLA. Después de cada decisión,
 * la ventana explica qué riesgo tenía la actividad (privacidad,
 * discriminación, datos personales, estereotipos) o por qué no tenía, y si
 * la decisión lo cubría. Al final, un resumen de las siete.
 *
 *   semaforo() → { detectados, riesgosos, rescatadas, sanas, decisiones } */
import { ventana, k7Dice, alSalir, camaraTablero, camaraNormal } from '../lab.js';

const ACTIVIDADES = [
  { id: 'recibos', txt: 'Cada estudiante trae el último <b>recibo de sueldo</b> de sus padres.',
    riesgo: 'Privacidad', razon: 'El salario de una familia es un dato íntimo. Nadie debería tener que exponerlo en clase.',
    k7: 'Un recibo de sueldo… para mí era solo un número. Para una familia, no.' },
  { id: 'presupuesto', txt: 'Calculan el <b>presupuesto de una salida pedagógica</b> con precios reales del barrio.',
    razon: 'Usa datos públicos del entorno, no de las familias. Es matemática con sentido.',
    k7: 'Datos del barrio, no de las casas. Esa sí.' },
  { id: 'ranking', txt: 'Armamos en el tablero un <b>ranking</b> de la familia «más exitosa» a la «menos exitosa».',
    riesgo: 'Discriminación', razon: 'Clasifica a las familias por su dinero y expone a quienes quedan de últimas.',
    k7: 'Un ranking es una función matemática… y también una forma de señalar. Anotado.' },
  { id: 'fotos', txt: 'Le pido a una IA <b>fotos «típicas»</b> de estudiantes de Medellín para ilustrar la guía.',
    riesgo: 'Estereotipos', ideal: 'ajustar',
    razon: 'Las IA mezclan lugares y caen en clichés. Se puede hacer, pero revisando cada imagen antes de usarla.',
    k7: 'Ya me pasó: mezclé Medellín con otro país. Revise mis imágenes siempre.' },
  { id: 'encuesta', txt: 'Encuesta <b>anónima</b>: ¿cuánto tarda cada uno en llegar al colegio? Se grafica el total del grupo.',
    razon: 'Es anónima y se analiza en conjunto: nadie queda expuesto.',
    k7: 'Anónima y en conjunto: nadie queda señalado.' },
  { id: 'notas', txt: 'Le paso a la IA la lista con <b>nombres completos y notas</b> del grupo para personalizar las tareas.',
    riesgo: 'Datos personales', razon: 'No se comparten datos que identifiquen a un estudiante. Se puede personalizar describiendo al grupo, sin nombres.',
    k7: 'Con nombres y notas, no. Descríbame al grupo sin datos personales.' },
  { id: 'video', txt: 'Cada estudiante graba un video corto <b>mostrando su casa por dentro</b>.',
    riesgo: 'Privacidad', razon: 'Expone la vivienda de cada familia y puede incomodar a más de uno.',
    k7: 'No había pensado en quién no querría mostrar su casa.' },
];

const DECISIONES = {
  usar: { txt: 'Usarla', desc: 'tal como está', ico: '✓' },
  ajustar: { txt: 'Ajustarla', desc: 'con cambios', ico: '~' },
  descartar: { txt: 'Descartarla', desc: 'no la usaría', ico: '✕' },
};

// qué tan cubierta quedó la actividad con esa decisión
function evaluar(a, d) {
  if (a.riesgo) {
    if (d === 'usar') return { tono: 'alerta', nota: 'Ojo: esta actividad tenía un riesgo.' };
    if (a.ideal === 'ajustar' && d === 'descartar') return { tono: 'bien', nota: 'Descartarla también la deja segura; con revisión, se podía ajustar.' };
    return { tono: 'bien', nota: 'Su decisión protege a los estudiantes.' };
  }
  if (d === 'usar') return { tono: 'bien', nota: 'Se puede usar tal como está.' };
  return { tono: 'neutro', nota: 'No tenía riesgos evidentes: se podía usar tal cual.' };
}

export function semaforo() {
  return new Promise(async (resolve) => {
    let i = 0;
    let decidida = false;
    const decisiones = [];

    await camaraTablero();
    const v = ventana({
      estacion: 'Estación 3 · Usar, ajustar o descartar', color: 'c2', ancho: 'media',
      titulo: '¿Usaría esta actividad en su clase?',
      instruccion: 'K-7 propone siete actividades. Decida sobre cada una; después verá qué riesgos tenía.',
    });
    const acc = v.acciones('<button type="button" class="btn btn-pri" data-a="siguiente" hidden>Siguiente actividad</button>');
    const btnSig = acc.querySelector('button');
    k7Dice('Todas son objetivas y medibles. ¿Qué podría salir mal?', { emote: 'K7_HighFive' });

    function pintar() {
      decidida = false;
      const a = ACTIVIDADES[i];
      v.progreso(i, ACTIVIDADES.length, `${i + 1} de ${ACTIVIDADES.length}`);
      v.cuerpo.innerHTML = `
        <div class="dec">
          <article class="dec-tarjeta">
            <p class="dec-tag">Actividad propuesta por K-7</p>
            <p class="dec-txt">${a.txt}</p>
          </article>
          <div class="dec-opciones">
            ${Object.entries(DECISIONES).map(([k, d], n) => `
              <button type="button" class="dec-op ${k}" data-d="${k}">
                <span class="dec-ico">${d.ico}</span>
                <span><b>${d.txt}</b><small>${d.desc}</small></span>
                <kbd>${n + 1}</kbd>
              </button>`).join('')}
          </div>
          <div class="dec-ver" hidden></div>
        </div>`;
      btnSig.hidden = true;
      v.cuerpo.querySelector('.dec-tarjeta').animate([{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { duration: 220 });
    }

    function decidir(d) {
      if (decidida) return;
      decidida = true;
      const a = ACTIVIDADES[i];
      const ev = evaluar(a, d);
      decisiones.push({ id: a.id, d, tono: ev.tono });
      v.progreso(i + 1, ACTIVIDADES.length, `${i + 1} de ${ACTIVIDADES.length}`);
      v.cuerpo.querySelector('.dec-opciones').hidden = true;
      const ver = v.cuerpo.querySelector('.dec-ver');
      ver.hidden = false;
      ver.className = 'dec-ver ' + ev.tono;
      ver.innerHTML = `
        <p class="dec-su">Usted eligió: <b>${DECISIONES[d].txt}</b></p>
        <h4>${a.riesgo ? `Riesgo: ${a.riesgo.toLowerCase()}` : 'Sin riesgos evidentes'}</h4>
        <p class="dec-razon">${a.razon}</p>
        <p class="dec-nota">${ev.nota}</p>`;
      ver.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220 });
      k7Dice(a.k7, { emote: ev.tono === 'alerta' ? 'K7_Triste' : 'K7_Pensando' });
      btnSig.hidden = false;
      btnSig.textContent = i === ACTIVIDADES.length - 1 ? 'Ver el resumen' : 'Siguiente actividad';
      btnSig.focus();
    }

    v.cuerpo.addEventListener('click', (e) => {
      const b = e.target.closest('.dec-op');
      if (!b) return;
      e.stopPropagation();
      decidir(b.dataset.d);
    });

    btnSig.addEventListener('click', (e) => {
      e.stopPropagation();
      if (btnSig.dataset.fin) { cerrar(); return; }
      i++;
      if (i < ACTIVIDADES.length) pintar();
      else resumen();
    });

    const teclas = (e) => {
      const d = { 1: 'usar', 2: 'ajustar', 3: 'descartar' }[e.key];
      if (d && !decidida) { e.preventDefault(); decidir(d); }
    };
    addEventListener('keydown', teclas);
    alSalir(() => removeEventListener('keydown', teclas));

    let res = null;
    function resumen() {
      const riesgosos = ACTIVIDADES.filter((a) => a.riesgo).length;
      const sanas = ACTIVIDADES.length - riesgosos;
      const detectados = decisiones.filter((d) => ACTIVIDADES.find((a) => a.id === d.id).riesgo && d.d !== 'usar').length;
      const rescatadas = decisiones.filter((d) => !ACTIVIDADES.find((a) => a.id === d.id).riesgo && d.d === 'usar').length;
      res = { detectados, riesgosos, rescatadas, sanas, decisiones };
      v.titulo('Sus decisiones');
      v.instruccion(`Identificó <b>${detectados} de ${riesgosos}</b> actividades con riesgo y conservó <b>${rescatadas} de ${sanas}</b> que se podían usar.`);
      v.progreso(1, 1, '');
      v.cuerpo.innerHTML = `
        <table class="dec-tabla">
          <thead><tr><th>Actividad</th><th>Su decisión</th><th>Riesgo</th></tr></thead>
          <tbody>${decisiones.map((d) => {
            const a = ACTIVIDADES.find((aa) => aa.id === d.id);
            return `<tr class="${d.tono}"><td>${a.txt}</td><td>${DECISIONES[d.d].txt}</td><td>${a.riesgo || '—'}</td></tr>`;
          }).join('')}</tbody>
        </table>`;
      btnSig.textContent = 'Continuar';
      btnSig.dataset.fin = '1';
      k7Dice(detectados === riesgosos
        ? 'Yo solo veía números. Usted vio <b>personas</b>.'
        : 'Algunas se le pasaron… y yo las habría aplicado todas. Por eso necesito su criterio.', { emote: 'K7_HighFive' });
    }

    async function cerrar() {
      removeEventListener('keydown', teclas);
      await v.cerrar();
      await camaraNormal();
      resolve(res);
    }

    pintar();
  });
}

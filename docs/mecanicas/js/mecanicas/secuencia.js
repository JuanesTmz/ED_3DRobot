/* Mecánica · Rediseñar la clase.
 *
 * La clase de ecosistemas de K-7 (Expedición 4) tiene cuatro momentos:
 * inicio, exploración, construcción y cierre. Cada uno trae la actividad de
 * K-7 ya elegida y dos alternativas al lado. El docente cambia lo que quiera
 * y la PRUEBA con el grupo: la ventana se aparta, la cámara vuelve al aula y,
 * momento a momento, los pupitres reaccionan. Al volver, cada momento muestra
 * cómo le fue; lo que no funcionó se puede cambiar y probar otra vez.
 *
 *   ordenarClase() → { resultado (0-100), intentos, secuencia } */
import { ventana, k7Dice, camaraTablero, camaraNormal, esperar } from '../lab.js';
import { reaccionar, mostrarMedidor, medidorA, apagarGrupo } from '../pupitres.js';

// nivel: 'bien' (participan), 'medio' (a medias) o 'mal' (se aburren)
const MOMENTOS = [
  { titulo: 'Inicio', para: 'despertar la curiosidad', opciones: [
    { id: 'expo', txt: 'Explicación magistral de 40 minutos sobre qué es un ecosistema', nivel: 'mal', k7: true },
    { id: 'abejas', txt: 'Pregunta para abrir: ¿qué pasaría si desaparecen las abejas del barrio?', nivel: 'bien' },
    { id: 'video', txt: 'Ver un video de cinco minutos sobre ecosistemas', nivel: 'medio' },
  ] },
  { titulo: 'Exploración', para: 'observar y buscar', opciones: [
    { id: 'dictado', txt: 'Copiar del tablero la definición de ecosistema', nivel: 'mal', k7: true },
    { id: 'patio', txt: 'Salir al patio: encontrar tres seres vivos y anotar qué necesitan', nivel: 'bien' },
    { id: 'libro', txt: 'Leer el capítulo del libro y subrayar lo importante', nivel: 'medio' },
  ] },
  { titulo: 'Construcción', para: 'armar el concepto juntos', opciones: [
    { id: 'cuestionario', txt: 'Cuestionario de memoria: bioma, hábitat, cadena trófica', nivel: 'mal', k7: true },
    { id: 'red', txt: 'En grupos, armar la red de quién se come a quién con lo que encontraron', nivel: 'bien' },
    { id: 'esquema', txt: 'Completar un esquema que el profesor ya dejó hecho', nivel: 'medio' },
  ] },
  { titulo: 'Cierre', para: 'compartir y llevarse algo', opciones: [
    { id: 'examen', txt: 'Examen individual, en silencio, sin materiales', nivel: 'mal', k7: true },
    { id: 'presentan', txt: 'Cada grupo presenta su red y la conecta con la de otro grupo', nivel: 'bien' },
    { id: 'salida', txt: 'Pregunta de salida: ¿qué ecosistema hay cerca de su casa?', nivel: 'bien' },
  ] },
];

const REACCION = {
  bien: { burbujas: ['idea', 'entusiasmo', 'entusiasmo'], txt: 'Participan', k7: 'Manos arriba en todo el salón.' },
  medio: { burbujas: ['idea', 'duda', 'aburrido'], txt: 'Se animan a medias', k7: 'Algunos se animan; otros, no tanto.' },
  mal: { burbujas: ['aburrido', 'duda', 'aburrido'], txt: 'Se aburren', k7: 'Silencio y bostezos.' },
};
const VALOR = { bien: 25, medio: 12, mal: 3 };

export function ordenarClase() {
  return new Promise(async (resolve) => {
    // la clase de K-7, tal cual la diseñó
    const eleccion = MOMENTOS.map((m) => m.opciones.find((o) => o.k7).id);
    let probada = null;      // resultado de la última prueba, por momento
    let intentos = 0;

    await camaraTablero();
    const v = ventana({
      estacion: 'Estación 5 · Rediseñar la clase', color: 'c4',
      titulo: 'La clase de ecosistemas de K-7',
      instruccion: 'Cada momento trae la actividad de K-7 marcada. Cambie las que quiera y pruebe la clase con el grupo.',
    });
    v.cuerpo.innerHTML = `
      <ol class="clase">
        ${MOMENTOS.map((m, i) => `
          <li class="clase-fila" data-m="${i}">
            <div class="clase-momento">
              <span class="num">${i + 1}</span>
              <div><b>${m.titulo}</b><small>${m.para}</small><div class="clase-res"></div></div>
            </div>
            <div class="clase-ops">
              ${m.opciones.map((o) => `
                <button type="button" class="clase-op" data-o="${o.id}">
                  ${o.k7 ? '<span class="clase-tag">Versión de K-7</span>' : ''}
                  <span class="clase-op-txt">${o.txt}</span>
                </button>`).join('')}
            </div>
          </li>`).join('')}
      </ol>`;
    const acc = v.acciones('<button type="button" class="btn btn-pri" data-a="probar">Probar la clase con el grupo</button>');
    v.progreso(0, 1, '');
    k7Dice('Explicación, dictado, cuestionario y examen. Impecable… ¿no?', { emote: 'K7_Pensando' });

    const opcion = (i) => MOMENTOS[i].opciones.find((o) => o.id === eleccion[i]);

    function pintar() {
      v.cuerpo.querySelectorAll('.clase-fila').forEach((fila, i) => {
        fila.querySelectorAll('.clase-op').forEach((b) => b.classList.toggle('elegida', b.dataset.o === eleccion[i]));
        const res = fila.querySelector('.clase-res');
        const nivel = probada?.[i];
        // el resultado solo vale mientras no se cambie la actividad probada
        if (nivel && probada.ids[i] === eleccion[i]) {
          res.className = 'clase-res ' + nivel;
          res.textContent = REACCION[nivel].txt;
        } else {
          res.className = 'clase-res';
          res.textContent = '';
        }
      });
    }

    v.cuerpo.addEventListener('click', (e) => {
      const b = e.target.closest('.clase-op');
      if (!b) return;
      e.stopPropagation();
      const i = Number(b.closest('.clase-fila').dataset.m);
      eleccion[i] = b.dataset.o;
      pintar();
      const o = opcion(i);
      k7Dice(o.k7 ? 'Esa es la mía…' : `Para ${MOMENTOS[i].titulo.toLowerCase()}: «${o.txt.split(':')[0].toLowerCase()}». Anotado.`, { emote: o.k7 ? 'K7_Triste' : 'K7_HighFive' });
    });

    acc.addEventListener('click', async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      if (b.dataset.a === 'seguir') {
        await v.cerrar();
        await camaraNormal();
        resolve({ resultado: puntaje(), intentos, secuencia: eleccion.map((_, i) => opcion(i).txt) });
        return;
      }
      await probar();
    });

    const puntaje = () => eleccion.reduce((a, _, i) => a + VALOR[opcion(i).nivel], 0);

    /* ------------------------------------------------------- la prueba */

    async function probar() {
      intentos++;
      await v.ocultar();
      await camaraNormal();
      mostrarMedidor('Momento 1 · Inicio', 0);
      let acumulado = 0;
      for (let i = 0; i < MOMENTOS.length; i++) {
        const o = opcion(i);
        acumulado += VALOR[o.nivel];
        document.getElementById('medidor-titulo').textContent = `Momento ${i + 1} · ${MOMENTOS[i].titulo}`;
        await reaccionar(REACCION[o.nivel].burbujas, { pausa: 160 });
        medidorA(Math.round((acumulado / ((i + 1) * 25)) * 100), 700);
        k7Dice(`<b>${MOMENTOS[i].titulo}:</b> ${REACCION[o.nivel].k7}`,
          { emote: o.nivel === 'bien' ? 'K7_Saltito' : o.nivel === 'mal' ? 'K7_Triste' : 'K7_Pensando', ms: 1800 });
        await esperar(1800);
      }
      await esperar(400);
      apagarGrupo();
      probada = MOMENTOS.map((_, i) => opcion(i).nivel);
      probada.ids = [...eleccion];

      await camaraTablero();
      await v.mostrar();
      pintar();
      const flojos = probada.filter((n) => n !== 'bien').length;
      v.progreso(MOMENTOS.length - flojos, MOMENTOS.length, `Prueba ${intentos}`);
      if (!flojos) {
        v.instruccion('Los cuatro momentos funcionaron con el grupo.');
        v.acciones('<button type="button" class="btn btn-sec" data-a="probar">Probar otra vez</button><button type="button" class="btn btn-pri" data-a="seguir">Continuar</button>');
        k7Dice('Esa clase no la habría diseñado yo ni con un millón de datos.', { emote: 'K7_HighFive' });
      } else {
        v.instruccion(`Hubo ${flojos === 1 ? 'un momento que no funcionó' : `${flojos} momentos que no funcionaron`}. Cambie la actividad y pruebe otra vez.`);
        v.acciones('<button type="button" class="btn btn-sec" data-a="seguir">Dejarla así</button><button type="button" class="btn btn-pri" data-a="probar">Probar otra vez</button>');
        k7Dice('Donde se aburrieron, <b>cambie la actividad</b> y la probamos de nuevo.', { emote: 'K7_Pensando' });
      }
    }

    pintar();
  });
}

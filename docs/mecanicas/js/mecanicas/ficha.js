/* Mecánica · Documentar una práctica.
 *
 * Antes era llenar seis casillas: tedioso. Ahora se invierte el trabajo, que
 * es justo lo que enseña la Expedición 5:
 *   1. El docente cuenta una clase suya en dos o tres frases.
 *   2. K-7 la organiza en la ficha de práctica docente de seis campos, sin
 *      inventar: lo que no se deduce del relato queda vacío.
 *   3. El docente la revisa: corrige lo que no sea fiel y completa lo vacío.
 *
 * En el prototipo del repo Montaje el paso 2 lo hace el LLM (/api/lab/ficha).
 * Esta copia se publica estática en GitHub Pages, sin servidor, así que K-7
 * ordena el relato con reglas: parte el relato en frases y ubica cada una por
 * sus palabras clave. La ventana lo dice, para que el docente juzgue la
 * mecánica y no la calidad del ordenamiento.
 *
 *   documentarPractica() → { relato, campos, porLLM } */
import { ventana, k7Dice, camaraTablero, camaraNormal, esperar, escapar } from '../lab.js';

const CAMPOS = [
  { id: 'titulo', titulo: 'Título' },
  { id: 'contexto', titulo: 'Contexto real' },
  { id: 'meta', titulo: 'Meta de aprendizaje' },
  { id: 'triada', titulo: 'Docente, IA y estudiantes' },
  { id: 'inflexion', titulo: 'Momento de inflexión' },
  { id: 'evaluacion', titulo: 'Cómo supo que aprendieron' },
];

const INICIOS = ['Con mi grupo de…', 'Era una clase de…', 'Ese día me di cuenta de que…'];

/* ------------------------------------------- el relato, ordenado a mano --- */

// \b de JavaScript no reconoce tildes («noté», «decidí»): los bordes de
// palabra se miden contra cualquier letra
const clave = (alternativas) => new RegExp(`(?<!\\p{L})(?:${alternativas})(?!\\p{L})`, 'iu');

// en orden de prioridad: la frase va al primer campo cuyas claves aparezcan
const PISTAS = [
  ['evaluacion', clave('supe|al final|evalu\\p{L}*|demostr\\p{L}*|lograron|pudieron|explicaron|r[uú]brica|examen|prueba|resultados?|comprob\\p{L}*|se not[oó]')],
  ['inflexion', clave('vi que|not[eé]|me di cuenta|decid[ií]|cambi[eé]|entonces|de repente|improvis\\p{L}*|en ese momento|pero|no estaba en el plan')],
  ['meta', clave('quer[ií]a que|quer[ií]amos|objetivo|meta|para que|aprendieran|entendieran|comprendieran|el prop[oó]sito')],
  ['triada', clave('IA|inteligencia artificial|ChatGPT|Gemini|Copilot|chatbot|K-7|en grupos|en parejas|trabajaron|construyeron|armaron|investigaron')],
  ['contexto', clave('grado|grupo|curso|colegio|escuela|instituci[oó]n|estudiantes de|niñ[oa]s|j[oó]venes|años|vereda|barrio|comuna|rural|sede')],
];

// una coma seguida de uno de estos conectores abre otra idea del relato
const CONECTORES = /,\s+(?=(?:y\s+)?(?:quer[ií]a|pero|entonces|cuando|as[ií] que|al final|luego|despu[eé]s|porque|para que|mientras|ese d[ií]a)(?!\p{L}))/iu;

const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const cerrar = (s) => (/[.!?…]$/.test(s) ? s : s + '.');

function fichaPorReglas(relato) {
  const frases = relato
    .split(/(?<=[.!?;])\s+|\n+/)
    .flatMap((o) => o.split(CONECTORES))
    .map((s) => s.trim().replace(/^[,;\s]+|[,;\s]+$/g, '').replace(/^y\s+/i, ''))
    .filter((s) => s.split(/\s+/).length >= 3);

  const campos = { titulo: '', contexto: '', meta: '', triada: '', inflexion: '', evaluacion: '' };
  let anterior = null;
  frases.forEach((f, i) => {
    let campo = PISTAS.find(([, re]) => re.test(f))?.[0];
    // sin palabras clave: la primera frase suele presentar el grupo; las
    // demás siguen la idea de la frase anterior
    if (!campo) campo = i === 0 ? 'contexto' : anterior;
    if (!campo) return;
    campos[campo] = campos[campo] ? `${campos[campo]} ${cerrar(f)}` : cerrar(mayuscula(f));
    anterior = campo;
  });

  // el título solo si el docente nombró el tema: «una clase de fracciones…»
  const tema = relato.match(/clase de ([\p{L}\s]{3,40}?)(?=[,.;:]|\s(?:con|en|para|a|que|y)\s|$)/iu);
  if (tema) campos.titulo = 'Clase de ' + tema[1].trim().split(/\s+/).slice(0, 6).join(' ');

  for (const k of Object.keys(campos)) campos[k] = campos[k].slice(0, 240);
  return campos;
}

export function documentarPractica() {
  return new Promise(async (resolve) => {
    let relato = '';

    await camaraTablero();
    const v = ventana({
      estacion: 'Estación 6 · Documentar una práctica', color: 'c5', ancho: 'media',
      titulo: 'Cuéntele a K-7 una clase suya',
      instruccion: 'Una clase que recuerde con cariño. Dos o tres frases bastan: con qué grupo fue, qué pasó y qué hizo usted que no estaba en el plan.',
    });
    v.progreso(1, 2, 'Paso 1 de 2');
    v.cuerpo.innerHTML = `
      <div class="rel">
        <textarea class="rel-texto" rows="5" maxlength="700" placeholder="Escriba aquí su relato…"></textarea>
        <div class="sugerencias"><span>Para empezar:</span>${INICIOS.map((s) => `<button type="button" class="sug">${s}</button>`).join('')}</div>
      </div>`;
    const texto = v.cuerpo.querySelector('.rel-texto');
    let acc = v.acciones('<button type="button" class="btn btn-pri" data-a="organizar" disabled>Organizar con K-7</button>');
    k7Dice('Usted pone la memoria; yo la ordeno en la ficha. <b>Luego usted la revisa.</b>', { emote: 'K7_HighFive' });
    setTimeout(() => texto.focus(), 300);

    const revisar = () => { acc.querySelector('[data-a=organizar]').disabled = texto.value.trim().length < 25; };
    texto.addEventListener('input', revisar);
    texto.addEventListener('click', (e) => e.stopPropagation());
    v.cuerpo.querySelector('.sugerencias').addEventListener('click', (e) => {
      const s = e.target.closest('.sug');
      if (!s) return;
      e.stopPropagation();
      const inicio = s.textContent.replace(/…$/, '');
      texto.value = (texto.value.trim() ? texto.value.trim() + ' ' : '') + inicio + ' ';
      texto.focus();
      revisar();
    });

    acc.addEventListener('click', async function organizar(e) {
      const b = e.target.closest('[data-a=organizar]');
      if (!b || b.disabled) return;
      e.stopPropagation();
      acc.removeEventListener('click', organizar);
      relato = texto.value.trim();

      v.titulo('K-7 está organizando su relato');
      v.instruccion('');
      v.cuerpo.innerHTML = '<div class="rel-espera"><span class="thinking"><span></span><span></span><span></span></span><p>Ubicando cada parte de su relato en la ficha…</p></div>';
      v.acciones('');
      k7Dice('Deme un momento: no quiero poner palabras en su boca.', { emote: 'K7_Pensando' });

      await esperar(1100);
      mostrarFicha(fichaPorReglas(relato));
    });

    function mostrarFicha(campos) {
      const vacios = CAMPOS.filter((c) => !campos[c.id]).length;
      v.titulo('Su ficha de práctica docente');
      v.instruccion(vacios
        ? 'Revise lo que K-7 organizó. Corrija lo que no sea fiel a su clase y complete los campos vacíos.'
        : 'Revise lo que K-7 organizó y corrija lo que no sea fiel a su clase.');
      v.progreso(2, 2, 'Paso 2 de 2');
      v.cuerpo.innerHTML = `
        <div class="fic">
          ${CAMPOS.map((c) => `
            <label class="fic-campo ${campos[c.id] ? '' : 'vacio'}">
              <span class="fic-tit">${c.titulo}</span>
              <textarea rows="2" data-c="${c.id}" placeholder="K-7 no lo encontró en su relato. Complételo usted.">${escapar(campos[c.id] || '')}</textarea>
            </label>`).join('')}
        </div>
        <details class="fic-relato"><summary>Ver su relato original</summary><p>${escapar(relato)}</p></details>
        <p class="fic-aviso">En esta versión de prueba K-7 ordena el relato con reglas sencillas, sin IA. En la experiencia real lo hará un modelo de lenguaje, así que fíjese sobre todo en la mecánica: contar, dejar que K-7 ordene y revisar.</p>`;
      for (const ta of v.cuerpo.querySelectorAll('textarea')) {
        ta.addEventListener('click', (e) => e.stopPropagation());
        ta.addEventListener('input', () => ta.closest('.fic-campo').classList.toggle('vacio', !ta.value.trim()));
      }
      acc = v.acciones(`
        <button type="button" class="btn btn-sec" data-a="copiar">Copiar la ficha</button>
        <button type="button" class="btn btn-pri" data-a="listo">Guardar la ficha</button>`);
      k7Dice(vacios
        ? `Organicé su relato y dejé ${vacios === 1 ? 'un campo vacío' : `${vacios} campos vacíos`}: no quise inventarlos. <b>Complete lo que falta</b>.`
        : 'Organicé su relato. Revise que no haya dicho nada que usted no dijo.', { emote: 'K7_HighFive' });

      const leer = () => Object.fromEntries([...v.cuerpo.querySelectorAll('textarea[data-c]')].map((t) => [t.dataset.c, t.value.trim()]));
      acc.addEventListener('click', async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        e.stopPropagation();
        if (b.dataset.a === 'copiar') {
          const c = leer();
          const txt = ['FICHA DE PRÁCTICA DOCENTE', '', ...CAMPOS.map((k) => `${k.titulo}: ${c[k.id] || '(pendiente)'}`)].join('\n');
          try { await navigator.clipboard.writeText(txt); b.textContent = 'Copiada'; } catch { b.textContent = 'No se pudo copiar'; }
          return;
        }
        await v.cerrar();
        await camaraNormal();
        resolve({ relato, campos: leer(), porLLM: false });
      });
    }
  });
}

/* Laboratorio de mecánicas · el guion de las seis estaciones.
 *
 * Cada estación es una «expedición» corta con el mismo esqueleto:
 *   1. tarjeta de estación (qué mecánica se prueba)
 *   2. una ráfaga corta de K-7 que plantea el conflicto
 *   3. la mecánica, en su ventana
 *   4. la reacción de K-7 a lo que el docente hizo
 *   5. «Siguiente estación», con un «¿Me cuenta más?» opcional
 *
 * Los textos siguen la guía de tono que salió del feedback: turnos cortos,
 * usted, humor puntual y la «k» nerviosa solo una vez por estación. */
import { K, V, dicho } from './estado.js';
import { esperar, mostrarFinal } from '../js/lab.js';
import { reaccionar, mostrarMedidor, medidorA, apagarGrupo } from '../js/pupitres.js';
import { marcar } from '../js/mecanicas/marcar.js';
import { armarContexto } from '../js/mecanicas/contexto.js';
import { semaforo } from '../js/mecanicas/semaforo.js';
import { cazarInvenciones } from '../js/mecanicas/invenciones.js';
import { ordenarClase } from '../js/mecanicas/secuencia.js';
import { documentarPractica } from '../js/mecanicas/ficha.js';

const ICONO = (n) => `img/exp${n}/icon-f${n}.webp`;

/* nodos de guion propios del laboratorio (ver motor.js) */
const rafaga = (lineas, extra = {}) => ({ who: K, rafaga: lineas, ...extra });
const mecanica = (text, boton, fn, extra = {}) => ({ who: K, text, boton, mecanica: fn, ...extra });
const accion = (fn) => ({ accion: fn });
const siguiente = (texto, mas, label = 'Siguiente estación') => ({
  who: K, text: texto,
  options: mas ? [{ label }, { label: '¿Me cuenta más?', mas }] : [{ label }],
});

/* ===================================================== Estación 1 ===== */
/* Marcar problemas · la guía de trenes de la Expedición 1 */

const GUIA_ZONAS = [
  { id: 'trenes', etiqueta: 'Contexto de otro país', detalle: 'Trenes de alta velocidad de Amtrak, en Estados Unidos.',
    rects: [[46.7, 35.6, 44.5, 5.1], [38.4, 44.3, 34.6, 4.8]],
    k7: '¿Amtrak? En Medellín nadie ha montado en ese tren. <b>Lo saqué de una guía de Estados Unidos.</b>',
    pista: 'Fíjese de qué país son los trenes.', emote: 'K7_Triste' },
  { id: 'millas', etiqueta: 'Unidades que no se usan aquí', detalle: 'Millas, en lugar de kilómetros o cuadras.',
    rects: [[50.9, 53.8, 7.1, 4.6], [48, 80.7, 12.4, 3], [61.2, 80.5, 5.6, 3], [38, 74.1, 29, 3.6]],
    k7: 'Millas. Aquí se mide en kilómetros… o en <b>cuadras</b>, me dicen.',
    pista: 'Revise las unidades de medida.', emote: 'K7_Pensando' },
  { id: 'acela', etiqueta: 'Un referente desconocido', detalle: 'Acela Express: nadie en el salón sabe qué es.',
    rects: [[45.6, 61.8, 13.3, 5.1], [69.1, 74.1, 24, 3.6]],
    k7: '¿Acela Express? Ni yo sé bien qué es. Sus estudiantes, menos.',
    pista: 'Hay un nombre propio que nadie en el salón reconocería.', emote: 'K7_Triste' },
  { id: 'grado', etiqueta: 'El grado no coincide', detalle: 'K-7 dijo quinto grado; la guía dice séptimo.',
    rects: [[62.4, 5.1, 15.4, 6.5]],
    k7: 'Le dije <b>quinto</b> y la guía dice <b>séptimo</b>. Ni conmigo mismo me pongo de acuerdo.',
    pista: 'Compare la guía con lo que K-7 le dijo, arriba.', emote: 'K7_Triste' },
];

const GUIA_SENUELOS = [
  { rects: [[31, 20.8, 41, 4.2]], k7: 'El tema está bien: las fracciones sí son de su plan.' },
  { rects: [[6.7, 26.6, 87.5, 4.7]], k7: 'El objetivo está bien planteado.' },
  { rects: [[10, 91.3, 21.4, 4.2]], k7: '55 minutos: eso sí lo calculé bien.' },
  { rects: [[75.8, 79.2, 7.7, 16], [43, 83.6, 23.4, 5.8]], k7: 'Las gráficas están bien: 3/4 es 3/4 en cualquier país.' },
  { rects: [[6.3, 43.3, 30.3, 46.1]], k7: 'Esa ilustración está bien. El problema está en el texto.' },
];

const ESTACION_1 = [
  { chapter: 'Estación 1 · Marcar problemas',
    note: 'K-7 trae una guía de matemáticas «impecable». Usted la revisa con ojos de profe.',
    icono: ICONO(1), color: 'c1',
    resumen: 'Toque en una guía lo que no funcionaría en su salón.',
    lab: { mecanica: 'tocar zonas de una imagen', duracion: '≈ 2 min',
      prueba: 'Reemplaza a «¿usaría esta clase?» con tres respuestas prearmadas.' } },

  rafaga([
    { t: 'Buenas, profe. Preparé una clase de fracciones para estudiantes de <b>quinto grado</b>, en Medellín.', emote: 'K7_HighFive' },
    { t: 'Revisé miles de planes de estudio. En el papel es impecable…', emote: 'K7_Pensando' },
    { t: 'Pero la probé y <b>no funciona</b>. ¿Me ayuda a ver por qué?', emote: 'K7_Triste' },
  ]),

  mecanica('Aquí está la guía. Tóquela donde vea algo que no funcionaría en su salón.',
    'Revisar la guía',
    () => marcar({
      estacion: 'Estación 1 · Marcar problemas', color: 'c1',
      titulo: '¿Qué no funcionaría en un salón de Medellín?',
      instruccion: 'Toque en la guía cada cosa que no encaje con sus estudiantes. Hay cuatro.',
      cita: '«Preparé una clase de fracciones para estudiantes de <b>quinto grado</b>, en Medellín.»',
      img: 'img/exp1/actividad1-1.webp', ancho: 1498, alto: 688,
      zonas: GUIA_ZONAS, senuelos: GUIA_SENUELOS,
      saludo: 'Mírela con calma. Yo no le veo nada raro.',
      alFallar: ['Ahí no veo nada raro. Busque lo que suena a <b>otro país</b>.', 'Compare también con lo que le dije arriba.'],
      alCompletar: 'Los cuatro. Y todos dicen lo mismo: <b>diseñé para un salón que no es el suyo</b>.',
    }),
    { campo: 'guia' }),

  { who: K, emote: 'K7_Pensando', dynamic: async () => {
    const r = dicho.guia || { segundos: 0 };
    const tiempo = r.segundos < 60 ? `${r.segundos} segundos` : `${Math.round(r.segundos / 60)} minutos`;
    return `Usted los encontró en ${tiempo}. Yo no vi ninguno en millones de cálculos.`;
  } },

  siguiente('La IA no conoce su salón. <b>Usted sí.</b>', [
    rafaga([
      { t: 'Las IA completamos patrones con lo que más aparece en internet.', emote: 'K7_Pensando' },
      'Y en internet hay muchas más guías de Estados Unidos que de la Comuna 13.',
      { t: 'Sin su contexto, describo <b>el salón promedio de otro país</b>.', emote: 'K7_Triste' },
    ]),
  ]),
];

/* ===================================================== Estación 2 ===== */
/* Armar el contexto · la misma guía, reconstruida con lo que dice el docente */

const conexionFinal = () => 86 + (dicho.contexto?.nota ? 8 : 0);

const ESTACION_2 = [
  { chapter: 'Estación 2 · Armar el contexto',
    note: 'Usted le da a K-7 el contexto que le falta y ve el cambio en la guía y en la reacción del grupo.',
    icono: ICONO(1), color: 'c1',
    resumen: 'Responda cinco preguntas y vea cómo cambia la guía.',
    lab: { mecanica: 'responder paso a paso y ver la consecuencia', duracion: '≈ 3 min',
      prueba: 'Reemplaza «¿qué le cambio?» y «¿quiénes son sus estudiantes?». La respuesta del docente cambia algo visible.' } },

  rafaga([
    { t: 'Antes de arreglar nada, hagamos una prueba.', emote: 'K7_Pensando' },
    { t: 'Voy a dar mi guía de trenes, tal cual, a un grupo de su colegio.', emote: 'K7_HighFive' },
  ]),

  accion(async () => {
    mostrarMedidor('Conexión del grupo', 0);
    await reaccionar(['duda', 'aburrido', 'duda']);
    await medidorA(18, 1500);
    await esperar(900);
  }),

  rafaga([
    { t: 'Dieciocho por ciento de conexión. Dudas y bostezos.', emote: 'K7_Triste' },
    { t: 'Me falta saber de su salón. Esta vez, <b>le pregunto a usted</b>.', emote: 'K7_Pensando' },
  ]),

  mecanica('Son cinco preguntas cortas.', 'Responder',
    () => { apagarGrupo(); return armarContexto(); },
    { campo: 'contexto' }),

  accion(async () => {
    mostrarMedidor('Conexión del grupo', 18);
    await esperar(300);
    await reaccionar(['idea', 'entusiasmo', 'idea']);
    await medidorA(conexionFinal(), 1800);
    await esperar(900);
  }),

  rafaga(() => [
    { t: `${conexionFinal()} % de conexión. Mire esas caras.`, emote: 'K7_Saltito' },
    { t: 'Mismas fracciones. Lo único que cambió fue <b>el contexto que usted me dio</b>.', emote: 'K7_HighFive' },
  ]),

  siguiente('Esta ya no es mi guía, profe. Es la suya.', [
    rafaga([
      { t: 'Lo que usted hizo tiene nombre: darle <b>contexto</b> a la IA.', emote: 'K7_Pensando' },
      'Grado, situación, medidas, materiales, forma de trabajo… y lo que solo usted sabe de su grupo.',
      { t: 'Con eso, cualquier IA —yo incluido— deja de adivinar.', emote: 'K7_HighFive' },
    ]),
  ]),
];

/* ===================================================== Estación 3 ===== */
/* Usar, ajustar o descartar · «La familia campeona» (Expedición 2), y un
   ejemplo opcional con la foto hecha por IA de la misma expedición */

const FOTO_ZONAS = [
  { id: 'letrero', etiqueta: 'Letrero en otro idioma', detalle: 'La cartelera está escrita en hindi.',
    rects: [[2.5, 17.1, 20.75, 50.2]], k7: 'Letras en hindi: mezclé dos salones de dos países.', pista: 'Lea la cartelera de la pared.', emote: 'K7_Triste' },
  { id: 'mapa', etiqueta: 'El mapa señala otro país', detalle: 'Además de Colombia, resalta la India.',
    rects: [[25.2, 28.5, 11, 28]], k7: 'El mapa resalta la India, además de Colombia.', pista: 'Mire qué países resalta el mapa.', emote: 'K7_Pensando' },
  { id: 'tuktuk', etiqueta: 'Un vehículo de otro lugar', detalle: 'Un tuk tuk; en Medellín hay taxis amarillos.',
    rects: [[85.25, 55.3, 4.5, 12.2]], k7: 'Un tuk tuk. En Medellín hay taxis amarillos, no esto.', pista: 'Mire la calle, por la ventana.', emote: 'K7_Triste' },
];
const FOTO_SENUELOS = [
  { rects: [[17.5, 67, 33, 33]], k7: 'Los uniformes sí parecen de un colegio de aquí.' },
  { rects: [[52.3, 24.5, 15, 13], [60, 37, 7.3, 28], [78, 5, 19.5, 40]], k7: 'Las casas de ladrillo en la ladera: eso sí es Medellín.' },
  { rects: [[92.5, 49, 4.2, 17.5]], k7: 'Los taxis amarillos: esos sí son de aquí.' },
  { rects: [[53.75, 38.5, 5.75, 11.6]], k7: 'La profesora está bien. Busque en el salón y en la calle.' },
];

const ESTACION_3 = [
  { chapter: 'Estación 3 · Usar, ajustar o descartar',
    note: 'K-7 diseñó «La familia campeona» y otras actividades. Usted decide cuáles usaría, cuáles ajustaría y cuáles descartaría.',
    icono: ICONO(2), color: 'c2',
    resumen: 'Decida sobre siete actividades que le propone K-7.',
    lab: { mecanica: 'decidir sobre cada actividad', duracion: '≈ 3 min',
      prueba: 'Reemplaza cinco preguntas abiertas sobre ética por decisiones concretas con explicación inmediata.' } },

  rafaga([
    { t: 'Esta vez fui por los datos duros, profe. Objetivos, medibles, sin margen de error.', emote: 'K7_HighFive' },
    { t: 'Le traigo siete actividades. Dígame cuáles usaría en su clase.', emote: 'K7_Pensando' },
  ]),

  mecanica('Una por una. Después de cada decisión le cuento qué riesgos veo ahora.',
    'Ver las actividades', semaforo, { campo: 'semaforo' }),

  { who: K, text: 'Otra cosa: le pedí a una IA una foto de un salón de Medellín, y algo salió raro.',
    options: [
      { label: 'Siguiente estación' },
      { label: 'Ver la foto', mas: [
        mecanica('Aquí está. Toque lo que no corresponde a un salón de Medellín.', 'Revisar la foto',
          () => marcar({
            estacion: 'Estación 3 · Usar, ajustar o descartar', color: 'c2',
            titulo: '¿Qué no corresponde a un salón de Medellín?',
            instruccion: 'Una IA generó esta foto sin conocer su ciudad. Toque lo que viene de otro lugar. Hay tres.',
            img: 'img/exp2/imagen-ia2-3.webp', ancho: 2000, alto: 817,
            zonas: FOTO_ZONAS, senuelos: FOTO_SENUELOS,
            alFallar: ['Eso sí podría ser de aquí. Busque lo que viene de <b>otro país</b>.'],
            alCompletar: 'Sin información de su ciudad, <b>la IA rellena con lo que tiene</b>: otro país.',
          }), { campo: 'foto' }),
        siguiente('Por esos vacíos podemos causar daño sin darnos cuenta. Por eso, <b>su revisión va primero</b>.'),
      ] },
    ] },
];

/* ===================================================== Estación 4 ===== */
/* Cazar invenciones · la Batalla de Boyacá inventada (Expedición 3) */

const ESTACION_4 = [
  { chapter: 'Estación 4 · Cazar invenciones',
    note: 'Un trabajo de historia bien redactado y lleno de cosas que nunca pasaron. Usted encuentra lo inventado.',
    icono: ICONO(3), color: 'c3',
    resumen: 'Encuentre lo inventado en un trabajo de historia.',
    lab: { mecanica: 'tocar frases de un texto', duracion: '≈ 2 min',
      prueba: 'Reemplaza «¿lo presentaría a un concurso?» con tres respuestas prearmadas. El texto se revisa frase por frase.' } },

  rafaga([
    { t: 'Profe, estoy en <b>kkkrisis</b>.', emote: 'K7_Triste' },
    'Escribí sobre la Batalla de Boyacá. Todos dicen que está mal.',
    { t: 'Yo lo veo impecable. ¿Me ayuda a revisarlo?', emote: 'K7_Pensando' },
  ]),

  mecanica('Aquí está mi trabajo, con la ilustración que generé.',
    'Revisar el trabajo', cazarInvenciones, { campo: 'invenciones' }),

  rafaga([
    { t: 'Lo que me pasó tiene nombre: <b>alucinación</b>.', emote: 'K7_Pensando' },
    'Completo patrones de palabras probables. Suena verdadero aunque no lo sea.',
  ]),

  siguiente('Por eso lo que escribe una IA <b>siempre se verifica</b>.', [
    rafaga([
      { t: 'Escribo igual de seguro cuando acierto que cuando invento.', emote: 'K7_Pensando' },
      'Señales para desconfiar: fechas parecidas a otras, citas muy académicas, datos que nadie más menciona.',
      { t: 'Y lo mejor: pídame las fuentes… <b>y revíselas usted</b>.', emote: 'K7_HighFive' },
    ]),
  ]),
];

/* ===================================================== Estación 5 ===== */
/* Rediseñar la clase · la clase de ecosistemas (Expedición 4) */

const ESTACION_5 = [
  { chapter: 'Estación 5 · Rediseñar la clase',
    note: 'K-7 diseñó una clase de ecosistemas perfecta en teoría y aburrida en la práctica. Usted la rediseña y la prueba con el grupo.',
    icono: ICONO(4), color: 'c4',
    resumen: 'Cambie momentos de una clase y pruébela con el grupo.',
    lab: { mecanica: 'elegir por momento, probar y ajustar', duracion: '≈ 3 min',
      prueba: 'Reemplaza «¿qué tiene una clase que funciona?» y «¿qué no funciona?». Se puede ajustar y volver a probar.' } },

  rafaga([
    { t: 'Profe, diseñé una clase sobre <b>ecosistemas</b>, inspirada en Humboldt.', emote: 'K7_HighFive' },
    { t: 'La profe Vero dice que así nadie se va a emocionar. ¿Me ayuda?', emote: 'K7_Triste' },
  ]),

  mecanica('Aquí está, momento por momento.', 'Ver la clase', ordenarClase, { campo: 'clase' }),

  rafaga(() => {
    const c = dicho.clase || { intentos: 1 };
    return [
      { t: c.intentos > 1 ? `La probó ${c.intentos} veces hasta que funcionó. Eso también es enseñar.` : 'Así se ve una clase donde los estudiantes hacen algo.', emote: 'K7_Saltito' },
      { t: 'Yo sé mucho de ecosistemas. Usted sabe <b>cómo se aprende</b>.', emote: 'K7_Pensando' },
    ];
  }),

  siguiente('Sin interacción humana no hay pedagogía. Ahora lo vi.'),
];

/* ===================================================== Estación 6 ===== */
/* Documentar una práctica · la ficha de la Expedición 5, ahora al revés:
   el docente cuenta, K-7 organiza, el docente revisa */

const ESTACION_6 = [
  { chapter: 'Estación 6 · Documentar una práctica',
    note: 'Usted cuenta una clase suya en pocas frases; K-7 la organiza en una ficha y usted la revisa.',
    icono: ICONO(5), color: 'c5',
    resumen: 'Cuente una clase suya: K-7 la ordena y usted la revisa.',
    lab: { mecanica: 'relato libre + revisión', duracion: '≈ 3 min',
      prueba: 'Reemplaza «escriba un párrafo que incluya estos puntos». La IA hace la estructura; el docente pone la experiencia y el criterio.' } },

  rafaga([
    { t: 'Profe, todo lo que sé de pedagogía lo leí.', emote: 'K7_Triste' },
    { t: 'Usted lo vivió. Cuénteme una clase suya y yo la ordeno en una ficha para otros colegas.', emote: 'K7_HighFive' },
  ]),

  mecanica('Cuéntela como se la contaría a un colega.', 'Contar una clase', documentarPractica, { campo: 'ficha' }),

  { who: K, text: 'Profe, alguien quiere estar aquí para el cierre. ¡Ahí viene la profe Vero!',
    options: [{ label: 'Hola, profe Vero' }], entra: true, emote: 'K7_Saltito' },
  { who: V, text: 'Profe, lo que acaba de hacer tiene nombre: <b>aprendizaje profesional</b>.',
    emote: 'Profesora_Eureka', reaccion: 'K7_Saltito' },
  { who: V, text: 'K-7 puso la estructura. La experiencia y el criterio son suyos: eso ninguna IA lo hace sola.',
    emote: 'Profesora_Mirando', reaccion: 'K7_HighFive', options: [{ label: 'Terminar' }] },

  accion(async () => {
    await esperar(200);
    mostrarFinal();
  }),
];

export const ESTACIONES = [ESTACION_1, ESTACION_2, ESTACION_3, ESTACION_4, ESTACION_5, ESTACION_6];

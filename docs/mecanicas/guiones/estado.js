// Estado y utilidades compartidas por todos los guiones de expedición
// (ver expedicion1.js, expedicion2.js…) y por js/motor.js, que es quien
// escribe en `dicho` y en `docente` cuando el docente responde.

import { pedirEnganche, pedirActividadAdaptada } from '../js/api.js';

export const K = 'K-7';
export const V = 'Profe Vero';

// nombre que el docente declare (sale de la primera respuesta abierta,
// ver nombreDe() en js/motor.js); las expediciones solo lo leen.
export let docente = 'Docente';
export function setDocente(nombre) { docente = nombre; }

// lo que el docente va aportando en cada expedición, por campo. No hace
// falta declarar las llaves de antemano: cada expedición usa las suyas.
export const dicho = {};

export const cita = (s, n = 120) => (s.length > n ? s.slice(0, n - 3).trim() + '…' : s);

/* --------------------------------------------------- nodos del guion --- */

export const say  = (text) => ({ who: K, text });
export const vero = (text) => ({ who: V, text });
/* pregunta abierta: guarda lo escrito en dicho[campo] */
export const ask  = (text, campo, placeholder) => ({ who: K, text, input: campo, placeholder });
/* pregunta cerrada: cada opción trae la réplica con la que K-7 la recibe */
export const pick = (text, options) => ({ who: K, text, options });
/* botón de un solo camino: sirve de latido entre bloques */
export const beat = (text, label) => ({ who: K, text, options: [{ label }] });
export const dyn  = (fn) => ({ who: K, dynamic: fn });
/* cierre de expedición: las puertas del aula se cierran y, detrás de ellas,
   aparece esta tarjeta con el resumen + la insignia antes de pasar a la
   siguiente expedición (ver next() en js/motor.js y mostrarConclusion() en js/navegacion.js) */
// `transicion`: 'puerta' (las puertas del aula, por defecto) o 'cortina' (dos
// telones de teatro) — hoy solo la usa el cierre de la Expedición 5, previo
// al epílogo, para marcar el fin del "juego" con algo distinto al resto.
export const conclusion = (resumen, insignia, titulo, boton, siguiente, transicion) => ({ conclusion: { resumen, insignia, titulo, boton, siguiente, transicion } });
/* emote condicional: K-7 se pone triste si el docente dejó ese campo en blanco */
export const emoteSiSilencio = (campo) => () => (dicho[campo] ? null : 'K7_Triste');
/* cierre final del videojuego (solo lo usa epilogo.js): cierra las cortinas
   de teatro y redirige a esa URL -no hay guion después de esto, así que no
   hace falta un nodo más que mostrar. */
export const finalizar = (url) => ({ finalizar: url });

/* --------------------------------------------------------------- LLM --- */
/* K-7 no improvisa el contenido pedagógico: el cuerpo de cada respuesta
   dinámica de cada expedición sigue siendo texto fijo. Lo único que genera
   el LLM (ver server/agente.js) es la frase de "enganche" que reacciona a
   lo que el docente escribió, delante de ese texto fijo — así nunca puede
   desviar la lección ni inventar datos. Si el servidor no responde (sin
   conexión, sin credenciales, lo que sea), se muestra el texto fijo solo:
   la experiencia nunca depende del LLM para funcionar. */

export async function conEnganche(persona, pregunta, userText, canonico) {
  const enganche = await pedirEnganche(persona, pregunta, userText, canonico);
  return enganche ? `${enganche}\n\n${canonico}` : canonico;
}

/* «Segundas versiones» de una actividad ya diseñada (ver claseReconstruida en
   expedicion1.js): a diferencia de conEnganche, aquí el LLM sí puede
   reescribir el contenido pedagógico —pero solo para adaptar una plantilla ya
   fija a lo que el docente contó de su aula, nunca para inventar de cero. Si
   el servidor no responde, se muestra la plantilla genérica tal cual. */
export async function conActividadAdaptada(contexto, rumbo, plantilla) {
  if (!rumbo) return plantilla;
  const actividad = await pedirActividadAdaptada(contexto, rumbo, plantilla);
  return actividad || plantilla;
}

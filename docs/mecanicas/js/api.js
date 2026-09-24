/* Laboratorio de mecánicas · las llamadas al LLM, apagadas.
 *
 * En la expedición real este archivo habla con /api/agent (server/index.js).
 * Aquí el laboratorio se sirve estático desde GitHub Pages, sin servidor ni
 * credenciales, así que las dos funciones devuelven null de una vez y el
 * guion sigue con su texto fijo, que es justo lo que la expedición real hace
 * cuando el LLM no contesta (ver conEnganche en guiones/estado.js). Ninguna
 * estación del laboratorio las llama hoy; se dejan para que estado.js cargue
 * igual que en la expedición. */

export async function pedirEnganche() {
  return null;
}

export async function pedirActividadAdaptada() {
  return null;
}

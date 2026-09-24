/* Laboratorio de mecánicas · la partida. Misma forma que
 * apps/expedicion/js/partida.js (repo Montaje), que en esta carpeta ocupa su
 * lugar, pero el guion son las seis estaciones del laboratorio. */
import { ESTACIONES } from '../guiones/estaciones.js';

// Las seis cuentan como «expediciones»: así ninguna se trata como epílogo
// (sin accesorios de K-7, sin nodo oculto en la línea de tiempo).
export const EXPEDICIONES = ESTACIONES;
export const FASES = [...ESTACIONES];
export const TITULO_A_INDICE = new Map(FASES.map((exp, i) => [exp[0].chapter, i]));

export const script = [...FASES.flat(), { end: true }];

export const inicioExpEnScript = [];
{
  let acc = 0;
  for (const exp of FASES) { inicioExpEnScript.push(acc); acc += exp.length; }
}

export const partida = {
  expActualIdx: 0,
  nodosVistosExp: 0,
  totalNodosExp: 1,
  fasesCompletadas: new Set(),
  expedicionesEmpezadas: new Set(),
  transicionCierre: 'puerta',
};

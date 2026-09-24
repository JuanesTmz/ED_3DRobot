/* Laboratorio de mecánicas · arranque.
 *
 * Primero el kit del laboratorio (menú de estaciones, ajustes) y después el
 * main.js de la expedición, que carga K-7, el aula y arranca el guion. En esta
 * carpeta, el motor.js y el partida.js que ese main.js importa son los del
 * laboratorio (ver LEEME.md). */
import { iniciarLab } from './lab.js';
import './main.js';
import { irAExpedicion } from './motor.js';

iniciarLab({ irAEstacion: irAExpedicion });

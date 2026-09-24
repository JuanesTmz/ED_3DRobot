/* Expedición Docente · Arranque de la expedición: pone en marcha cada módulo en
 * el mismo orden de siempre, conecta la navegación con el motor, y lleva el
 * bucle de render y el redimensionado, que tocan a varios módulos a la vez. */
import { renderer, scene, camera, clock, k7, profesora, medirFotograma, moverCamara } from './escena.js';
import { accGltf, montarAccesoriosK7, cargarAula } from './aula.js';
import { veroEnEscena, frame, cargarProfesora } from './elenco.js';
import {
  iniciarImagenes, resizeChalk, actualizarChalk, pizarraActiva, ponerRectoImg, rectoTablero,
  insigniaActiva, ponerLaminaInsignia, precargarImagenes, imagenesDelGuion,
} from './imagenes.js';
import { iniciarHistorial } from './historial.js';
import { iniciarNavegacion, abrirPuertas, marcarCarga, avisarFalloCarga, retirarBarraCarga } from './navegacion.js';
import { iniciarMotor, irAExpedicion, next, start } from './motor.js';
import { script } from './partida.js';

// se llama al final de este archivo, cuando todo lo demás ya está en marcha
async function iniciarK7() {
  await k7.cargar({
    onProgress: (frac) => { marcarCarga(frac); },
  });

  if (!k7.model) {
    avisarFalloCarga();
  } else {
    k7.agregarA(scene);
    frame();
    // el .glb de los accesorios puede haber llegado antes que el personaje:
    // si ya está en mano, recién ahora hay hueso del que colgarlos
    if (accGltf) montarAccesoriosK7(accGltf);
    start();
  }
  // las puertas del aula se abren aquí (ver CSS de #loader.done): la escena
  // ya está lista detrás de ellas cuando empiezan a separarse.
  await abrirPuertas();

  // la barra de progreso ya cumplió: si las puertas se vuelven a cerrar más
  // adelante (cambio de expedición, ver mostrarConclusion()), que no vuelva.
  retirarBarraCarga();
}

cargarProfesora();
cargarAula();
iniciarImagenes();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  resizeChalk();
  if (k7.model) frame();
  if (pizarraActiva) ponerRectoImg(rectoTablero());
});

renderer.setAnimationLoop(() => {
  // Tope al paso de tiempo: si el docente se va a otra pestaña, el navegador
  // congela el rAF y al volver getDelta() devuelve de golpe todo lo que pasó.
  // Sin tope, ese salto se come de una vez el gesto que estuviera sonando.
  const dt = Math.min(clock.getDelta(), 0.05);

  medirFotograma(dt);
  k7.actualizar(dt);
  if (veroEnEscena) profesora.actualizar(dt);
  actualizarChalk(dt);
  moverCamara();
  if (insigniaActiva) ponerLaminaInsignia();
  renderer.render(scene, camera);
});

precargarImagenes(imagenesDelGuion(script));

iniciarNavegacion({ alSaltar: irAExpedicion, alContinuar: next });
iniciarHistorial();
iniciarMotor();

iniciarK7();

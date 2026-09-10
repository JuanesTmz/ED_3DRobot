// Gesto de hablar: lipsync de la boca y cabeceo de cabeza/pecho.
//
// Lo comparten K-7 y la Profesora (antes estaba copiado en los dos modulos y
// se arreglaba dos veces o en ninguna).
//
// El cabeceo se monta ENCIMA de lo que deja la animacion: se le pide al hueso
// que ya trae el mixer y se le compone un giro pequeno. Eso obliga a un
// cuidado que antes no se tenia y que era el origen de que las cabezas "se
// fueran de largo":
//
//   El gesto se deshace al principio de cada fotograma, antes de que el mixer
//   escriba. Si no, se acumula. Y se acumula mas a menudo de lo que parece:
//   aunque todos los clips traigan pista para la cabeza, three.js solo
//   sobrescribe el hueso del todo cuando los pesos de las acciones activas
//   suman 1. En una transicion entre gestos (fadeIn/fadeOut) puede sumar
//   menos, y entonces mezcla contra el "estado original" que guardo al
//   activar la accion -un estado que, si ya tenia el cabeceo encima, queda
//   contaminado-. El resultado es una cabeza que se va girando de mas sin
//   que ninguna animacion se lo pida.
//
// Con restaurar() antes del mixer, el hueso siempre parte limpio y el gesto
// nunca puede acumularse, pasen los pesos que pasen.

export class Habla {
  constructor(THREE) {
    this.THREE = THREE;
    this.cabeza = null;
    this.pecho = null;

    this.activo = false;    // se enciende la primera vez que se llama a hablar()
    this.nivel = 0;         // 0..1, persigue a objetivo
    this.objetivo = 0;

    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._qCabeza = new THREE.Quaternion();
    this._qPecho = new THREE.Quaternion();
    this._guardado = false;
  }

  montar(cabeza, pecho) {
    this.cabeza = cabeza || null;
    this.pecho = pecho || null;
  }

  encender(hablando) {
    this.activo = true;
    this.objetivo = hablando ? 1 : 0;
  }

  /** Deshace el cabeceo del fotograma anterior. Va ANTES de mixer.update(). */
  restaurar() {
    if (!this._guardado) return;
    if (this.cabeza) this.cabeza.quaternion.copy(this._qCabeza);
    if (this.pecho) this.pecho.quaternion.copy(this._qPecho);
    this._guardado = false;
  }

  /** Aplica el cabeceo. Va DESPUES de mixer.update().
   *  Devuelve el nombre de la boca que toca en este fotograma. */
  aplicar(dt, bocaEnReposo) {
    // el nivel persigue al objetivo: sin esto el gesto arranca y para de golpe
    this.nivel += (this.objetivo - this.nivel) * Math.min(1, dt * 5);
    const boca = this._boca(bocaEnReposo);
    if (!this.cabeza || this.nivel < 0.002) return boca;

    // se guarda lo que dejo la animacion para poder volver a ello
    this._qCabeza.copy(this.cabeza.quaternion);
    if (this.pecho) this._qPecho.copy(this.pecho.quaternion);
    this._guardado = true;

    const t = performance.now() * 0.001, n = this.nivel;
    const e = this._e, q = this._q;
    // dos frecuencias que no encajan entre si, para que el cabeceo no se lea
    // como un tic mecanico
    e.set(
      (Math.sin(t * 9.5) * 0.040 + Math.sin(t * 3.6) * 0.016) * n,  // asiente
      Math.sin(t * 2.5) * 0.032 * n,                                // se gira
      Math.sin(t * 3.1) * 0.017 * n                                 // ladea
    );
    this.cabeza.quaternion.multiply(q.setFromEuler(e));

    if (this.pecho) {   // el pecho acompana, con retardo y mucha menos amplitud
      e.set(Math.sin(t * 9.5 - 0.9) * 0.010 * n, 0, 0);
      this.pecho.quaternion.multiply(q.setFromEuler(e));
    }
    return boca;
  }

  /* La boca va aparte del cabeceo: se elige aunque el nivel este a cero,
     porque en reposo tambien tiene que mostrar algo. */
  _boca(bocaEnReposo) {
    if (this.nivel < 0.02) return bocaEnReposo;
    const t = performance.now() * 0.001;
    // silabas: una onda rectificada abre y cierra la boca unas tres veces por
    // segundo. El seno de dentro le mete vaiven al ritmo y el de fuera cambia
    // el tamano de cada silaba; sin esos dos queda un tictac a compas
    const silaba = Math.max(0, Math.sin(t * 17.0 + Math.sin(t * 3.1)));
    const s = silaba * (0.55 + 0.45 * Math.sin(t * 5.3) ** 2);
    return s > 0.34 ? 'abierta' : 'feliz';
  }
}

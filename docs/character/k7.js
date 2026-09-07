// K-7, empaquetado para reusarse en cualquier escena three.js.
//
// Junta en un solo lugar todo lo que antes vivia duplicado entre index.html
// (el visor, con sus 6 poses) y charla.html (la conversacion, que solo mueve
// la boca al hablar): cargar los tres modelos, colgarles boca y ojos sueltos
// del hueso 'head', cambiar de gesto, pintarlos con una paleta.
//
// No importa three.js por su cuenta -asi no obliga a una version- sino que
// recibe el THREE y el GLTFLoader de quien lo use.
//
// Ver README.md de esta carpeta para el manual completo (convenciones de
// huesos, tabla de gestos, formato de paleta, como montarlo en un proyecto
// nuevo).

import { aplicarPaleta as aplicarPaletaBase } from './paleta.js';
export { aplicarPaleta, conectarBotones, PALETAS, ROL_DE_MATERIAL } from './paleta.js';

// Los tres modelos comparten armature y las mismas 6 animaciones (Idle mas 5
// gestos), asi que cambiar de modelo es solo alternar visibilidad.
export const MESHES = ['Modelo1', 'Modelo2', 'Modelo3'];

// Gestos que se tocan una vez y vuelven solos a Idle (no son un bucle).
export const UNA_VEZ = new Set(['K7_Saltito', 'K7_HighFive']);

// Sitio y escala de la boca por modelo, en el espacio del hueso 'head' (y =
// altura, z = hacia la cara). Cada modelo tiene la cara a distinta altura y
// anchura; son las medidas de la sonrisa que build_bocas.py les quito.
export const BOCA_DE_MODELO = {
  Modelo1: { pos: [0, 0.1883, 0.298], escala: 0.3172 },
  Modelo2: { pos: [0, 0.2338, 0.400], escala: 0.2474 },
  // Modelo3 lleva el cubo volteado y la carita bajada, porque la esquina
  // del cubo le caia encima. La z ya no es la del plano de la cara: el cubo
  // girado no ofrece un plano de frente sino una arista, asi que la boca se
  // adelanta hasta librarla. Lo mide build_modelo3.py y lo imprime al acabar.
  Modelo3: { pos: [0.0, 0.1389, 0.4352], escala: 0.2474 },
};

// La sonrisa 'feliz' esta dibujada del ancho de la vieja y se leia demasiado
// abierta; las demas bocas se quedan con el ancho que tienen dibujado.
export const ANCHO_DE_BOCA = { feliz: 0.85 };

// Igual que la boca, pero para los ojos que build_ojos.py les quito.
export const OJOS_DE_MODELO = {
  Modelo1: { pos: [0, 0.4670, 0.3100], escala: 0.5294 },
  Modelo2: { pos: [0, 0.5218, 0.4202], escala: 0.4129 },
  Modelo3: { pos: [0, 0.3858, 0.4722], escala: 0.4129 },
};

export const NOMBRES_BOCA = ['feliz', 'abierta', 'pensando', 'sorpresa', 'triste'];
export const NOMBRES_OJOS = ['normal', 'triste', 'guino', 'doble_guino', 'pensando'];

// Gesto de cada animacion: que boca y que ojos le corresponden. Las que no
// tienen una emocion propia se quedan con la cara de reposo.
export const GESTO_DE_ANIM = {
  Idle:         { boca: 'feliz', ojos: 'normal' },
  K7_Caminando: { boca: 'feliz', ojos: 'normal' },
  K7_HighFive:  { boca: 'feliz', ojos: 'guino' },
  K7_Saltito:   { boca: 'feliz', ojos: 'doble_guino' },
  K7_Triste:    { boca: 'triste', ojos: 'triste' },
  K7_Pensando:  { boca: 'pensando', ojos: 'pensando' },
};

export class K7 {
  /**
   * @param {object} opts
   * @param {typeof import('three')} opts.THREE
   * @param {new () => any} opts.GLTFLoader
   * @param {string} [opts.base] carpeta donde estan robot.glb/bocas.glb/ojos.glb
   * @param {(mensaje: string) => void} [opts.onError]
   * @param {(nombreAnim: string) => void} [opts.onAnimCambio] se llama cuando
   *   reproducir() cambia de accion, tambien cuando un gesto de una vez
   *   vuelve solo a Idle -para que la app resincronice sus propios botones.
   */
  constructor({ THREE, GLTFLoader, base = '.', onError, onAnimCambio } = {}) {
    this.THREE = THREE;
    this.GLTFLoader = GLTFLoader;
    this.base = base;
    this._onError = onError || ((m) => console.error('[K7]', m));
    this._onAnimCambio = onAnimCambio || null;

    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.parts = {};       // Modelo1/2/3 -> malla
    this.bocas = {};       // nombre -> malla
    this.ojos = {};        // nombre -> malla
    this.hCabeza = null;
    this.hPecho = null;

    this.modelo = MESHES[0];
    this.bocaEnReposo = 'feliz';   // a la que vuelve elegirBoca() cuando no habla
    this._paleta = 'uno';

    this._activeAction = null;
    this._bocaPuesta = null;
    this._ojosPuestos = null;

    // hablar(): lipsync + cabeceo, usado por escenas de conversacion. Se
    // activa solo si alguna vez se llama a hablar(), para no pisar la boca
    // que puso aplicarGesto() en escenas que usan las 6 poses (index.html).
    this._modoHabla = false;
    this._habla = 0;
    this._hablaObj = 0;
    this._qGesto = new THREE.Quaternion();
    this._eGesto = new THREE.Euler();
  }

  /** Carga robot.glb + bocas.glb + ojos.glb y monta la cara. */
  async cargar({ onProgress } = {}) {
    const [gltfRobot] = await Promise.all([
      // cache-bust: estos tres assets se re-exportan seguido mientras se
      // ajustan poses/gestos, y el navegador los sirve cacheados sin avisar
      this._cargarGLTF(`${this.base}/robot.glb?v=${Date.now()}`, onProgress),
      this._cargarCaras(`${this.base}/bocas.glb?v=${Date.now()}`, NOMBRES_BOCA, this.bocas),
      this._cargarCaras(`${this.base}/ojos.glb?v=${Date.now()}`, NOMBRES_OJOS, this.ojos),
    ]);
    if (gltfRobot) this._montarRobot(gltfRobot);
    this._montarCara();
    return this;
  }

  agregarA(scene) {
    if (this.model) scene.add(this.model);
  }

  // -------------------------------------------------------------- modelos --

  mostrarModelo(nombre) {
    if (!MESHES.includes(nombre)) return;
    this.modelo = nombre;
    for (const n of MESHES) if (this.parts[n]) this.parts[n].visible = (n === nombre);
    this._colocarBoca(nombre);
    this._colocarOjos(nombre);
  }

  aplicarPaletaPersonaje(id) {
    this._paleta = id;
    if (this.model) aplicarPaletaBase(this.model, id);
  }

  // ------------------------------------------------------------ boca/ojos --

  ponerBoca(nombre) {
    if (this._bocaPuesta === nombre || !this.bocas[nombre]) return;
    this._bocaPuesta = nombre;
    for (const n in this.bocas) this.bocas[n].visible = (n === nombre);
  }

  ponerOjos(nombre) {
    if (this._ojosPuestos === nombre || !this.ojos[nombre]) return;
    this._ojosPuestos = nombre;
    for (const n in this.ojos) this.ojos[n].visible = (n === nombre);
  }

  /** Boca y ojos que le tocan a esa animacion (ver GESTO_DE_ANIM). */
  aplicarGesto(nombreAnim) {
    const g = GESTO_DE_ANIM[nombreAnim];
    if (!g) return;
    this.ponerBoca(g.boca);
    this.ponerOjos(g.ojos);
  }

  // ---------------------------------------------------------- animaciones --

  /** Cambia de pose con mezcla de pesos (fadeOut/fadeIn) y aplica su gesto.
   *  Pensado para escenas con las 6 poses (ver index.html). */
  reproducir(nombreAnim, duracion = 0.5) {
    const next = this.actions[nombreAnim];
    if (!next || next === this._activeAction) return;
    const prev = this._activeAction;
    this._activeAction = next;

    next.reset();
    next.setEffectiveTimeScale(1);
    next.setEffectiveWeight(1);
    next.fadeIn(duracion);
    next.play();
    if (prev) prev.fadeOut(duracion);

    this.aplicarGesto(nombreAnim);
    this._onAnimCambio?.(nombreAnim);
  }

  // --------------------------------------------------------------- hablar --

  /** Prende/apaga el lipsync y el cabeceo de conversacion (ver charla.html).
   *  La boca vuelve a bocaEnReposo cuando se apaga o el nivel baja del todo. */
  hablar(activo) {
    this._modoHabla = true;
    this._hablaObj = activo ? 1 : 0;
  }

  // --------------------------------------------------------------- frame ---

  /** Se llama una vez por fotograma, con el mismo dt que usa el mixer. */
  actualizar(dt) {
    this.mixer?.update(dt);
    if (this._modoHabla) this._gestoDeHabla(dt);
  }

  // =============================================================== interno

  _cargarGLTF(url, onProgress) {
    return new Promise((resolve) => {
      new this.GLTFLoader().load(
        url,
        (gltf) => resolve(gltf),
        (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); },
        (e) => { this._onError(url + ': ' + e.message); resolve(null); },
      );
    });
  }

  _cargarCaras(url, nombres, destino) {
    return new Promise((resolve) => {
      new this.GLTFLoader().load(
        url,
        (gltf) => {
          for (const n of nombres) {
            const malla = gltf.scene.getObjectByName(n);
            if (!malla) { this._onError(`falta '${n}' en ${url}`); continue; }
            malla.castShadow = false;      // son planas y van pegadas a la cara
            malla.receiveShadow = false;
            malla.frustumCulled = false;   // cuelgan de un hueso: su caja no se recalcula
            malla.visible = false;
            destino[n] = malla;
          }
          resolve();
        },
        undefined,
        (e) => { this._onError(url + ': ' + e.message); resolve(); },
      );
    });
  }

  _montarRobot(gltf) {
    const THREE = this.THREE;
    const model = gltf.scene;

    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;   // la malla skinned se sale de su caja al animarse

      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        // contorno por casco invertido: normales ya volteadas al exportar
        if (/outline/i.test(m.name)) {
          m.side = THREE.FrontSide;
          m.polygonOffset = true;
          m.polygonOffsetFactor = 1;
        }
        if (m.name === 'M_lens') { m.transparent = true; m.opacity = 0.22; }
      }
    });

    this.model = model;

    for (const n of MESHES) this.parts[n] = model.getObjectByName(n);
    const faltan = MESHES.filter((n) => !this.parts[n]);
    if (faltan.length) this._onError('faltan mallas en robot.glb: ' + faltan.join(', '));

    this.hCabeza = model.getObjectByName('head');
    this.hPecho = model.getObjectByName('chest');
    if (!this.hCabeza) this._onError('falta el hueso head en robot.glb: K-7 se queda sin cara');

    if (gltf.animations.length) {
      this.mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) {
        const a = this.mixer.clipAction(clip);
        if (UNA_VEZ.has(clip.name)) {
          a.setLoop(THREE.LoopOnce);
          a.clampWhenFinished = true;
        }
        a.setEffectiveWeight(clip.name === 'Idle' ? 1 : 0);
        a.play();   // todas corren desde el arranque; el peso decide que se ve
        this.actions[clip.name] = a;
      }
      this._activeAction = this.actions['Idle'] || null;

      // los gestos de una vez vuelven solos a Idle al terminar
      this.mixer.addEventListener('finished', (e) => {
        if (UNA_VEZ.has(e.action.getClip().name)) this.reproducir('Idle');
      });
    }

    this.mostrarModelo(this.modelo);
    // pinta el cuerpo aunque la cara (mas abajo) no llegue a montarse
    aplicarPaletaBase(this.model, this._paleta);
  }

  _montarCara() {
    if (!this.hCabeza || !this.bocas.feliz || !this.ojos.normal) return;
    if (this.bocas.feliz.parent !== this.hCabeza) {
      for (const n in this.bocas) this.hCabeza.add(this.bocas[n]);
      for (const n in this.ojos) this.hCabeza.add(this.ojos[n]);
      this._colocarBoca(this.modelo);
      this._colocarOjos(this.modelo);
      this.ponerBoca('feliz');
      this.ponerOjos('normal');
    }
    // ya cuelgan del modelo: hay que pintarlas con la paleta en curso
    if (this.model && this._paleta) aplicarPaletaBase(this.model, this._paleta);
  }

  _colocarBoca(nombreMalla) {
    const m = BOCA_DE_MODELO[nombreMalla];
    if (!m) return;
    for (const n in this.bocas) {
      this.bocas[n].position.set(...m.pos);
      this.bocas[n].scale.set(m.escala * (ANCHO_DE_BOCA[n] ?? 1), m.escala, m.escala);
    }
  }

  _colocarOjos(nombreMalla) {
    const m = OJOS_DE_MODELO[nombreMalla];
    if (!m) return;
    for (const n in this.ojos) {
      this.ojos[n].position.set(...m.pos);
      this.ojos[n].scale.setScalar(m.escala);
    }
  }

  _gestoDeHabla(dt) {
    // el nivel persigue al objetivo: sin esto el gesto arranca y para de golpe
    this._habla += (this._hablaObj - this._habla) * Math.min(1, dt * 10);
    this._elegirBoca();
    if (!this.hCabeza || this._habla < 0.002) return;

    const t = performance.now() * 0.001, n = this._habla;
    const e = this._eGesto, q = this._qGesto;
    // dos frecuencias que no encajan entre si, para que el cabeceo no se lea
    // como un tic mecanico
    e.set(
      (Math.sin(t * 19.0) * 0.055 + Math.sin(t * 7.3) * 0.020) * n,   // asiente
      Math.sin(t * 4.7) * 0.045 * n,                                  // se gira
      Math.sin(t * 6.1) * 0.026 * n                                   // ladea
    );
    this.hCabeza.quaternion.multiply(q.setFromEuler(e));

    if (this.hPecho) {   // el pecho acompana, con retardo y mucha menos amplitud
      e.set(Math.sin(t * 19.0 - 0.9) * 0.013 * n, 0, 0);
      this.hPecho.quaternion.multiply(q.setFromEuler(e));
    }
  }

  /* La boca va aparte del gesto de cabeza: se elige aunque el nivel este a
     cero, porque en reposo tambien tiene que mostrar algo. */
  _elegirBoca() {
    if (this._habla < 0.02) { this.ponerBoca(this.bocaEnReposo); return; }
    const t = performance.now() * 0.001;
    // silabas: una onda rectificada abre y cierra la boca unas tres veces por
    // segundo. El seno de dentro le mete vaiven al ritmo y el de fuera cambia
    // el tamano de cada silaba; sin esos dos queda un tictac a compas
    const silaba = Math.max(0, Math.sin(t * 17.0 + Math.sin(t * 3.1)));
    const s = silaba * (0.55 + 0.45 * Math.sin(t * 5.3) ** 2);
    this.ponerBoca(s > 0.34 ? 'abierta' : 'feliz');
  }
}

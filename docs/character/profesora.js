// Profesora, empaquetada con la misma forma de API que K7 (ver k7.js) para
// que index.html pueda tratar a los dos personajes de manera intercambiable:
// cargar(), agregarA(), actualizar(dt), reproducir(nombreAnim), hablar().
//
// A diferencia de K-7 no tiene variantes de modelo ni paleta propia: un solo
// mesh, un solo armature (ver rig_profesora.py, que la riggea a partir de
// referencias/Profe.blend), 5 animaciones (Idle + 4 gestos). Tampoco trae
// boca propia -el modelo no la tiene- asi que reusa exactamente el mismo
// bocas.glb de K7, colgado del hueso 'head' con su propia constante de
// posicion/escala (ver BOCA_PROFESORA mas abajo, equivalente a
// BOCA_DE_MODELO en k7.js pero para un solo modelo en vez de tres).

export { NOMBRES_BOCA } from './k7.js';
import { NOMBRES_BOCA } from './k7.js';
import { Habla } from './habla.js';
import { aplicarPaleta } from './paleta.js';

// Gestos de una vez: se tocan y vuelven solos a Idle. Vero no tiene ninguno
// -y por eso el conjunto esta vacio-: sus gestos son bucles sostenidos, igual
// que K7_Pensando o K7_Triste, asi que se MANTIENEN mientras dure el mensaje
// y solo los deja cuando el guion pide otra cosa. El mecanismo se queda
// montado por si algun gesto futuro suyo si debe tocarse una sola vez.
export const UNA_VEZ = new Set();

// Boca por gesto. Ella no tiene ojos intercambiables: los suyos, con sus
// gafas, son parte fija de la malla.
export const GESTO_DE_ANIM = {
  Profesora_Idle:        { boca: 'feliz' },
  Profesora_Escribiendo: { boca: 'pensando' },
  Profesora_Eureka:      { boca: 'sorpresa' },
  Profesora_Mirando:     { boca: 'feliz' },
  Profesora_Caminando:   { boca: 'feliz' },
};

// Posicion/escala de la boca en el espacio local del hueso 'head' (misma
// convencion que BOCA_DE_MODELO en k7.js: x=lateral, y=altura sobre el
// origen del hueso, z=hacia la cara).
//
// No esta puesto a ojo: el hueso 'head' arranca en y=1.7223 y, midiendo la
// malla ya cargada, la cara va de y=1.794 (barbilla) a 2.207 (coronilla) con
// las gafas ocupando de 1.972 a 2.128. El hueco que queda para la boca es
// 1.794-1.972, y su borde de arriba -que es el origen de las mallas de
// bocas.glb- queda mejor arrimado a las gafas que centrado en ese hueco:
// y=1.930 de mundo, o sea 1.930 - 1.7223 = 0.208.
export const BOCA_PROFESORA = { pos: [0, 0.208, 0.186], escala: 0.13 };

export class Profesora {
  /**
   * @param {object} opts
   * @param {typeof import('three')} opts.THREE
   * @param {new () => any} opts.GLTFLoader
   * @param {string} [opts.base] carpeta donde estan profesora.glb/bocas.glb
   * @param {(mensaje: string) => void} [opts.onError]
   * @param {(nombreAnim: string) => void} [opts.onAnimCambio]
   */
  constructor({ THREE, GLTFLoader, base = '.', onError, onAnimCambio } = {}) {
    this.THREE = THREE;
    this.GLTFLoader = GLTFLoader;
    this.base = base;
    this._onError = onError || ((m) => console.error('[Profesora]', m));
    this._onAnimCambio = onAnimCambio || null;

    this.model = null;
    this.mixer = null;
    this.actions = {};
    this.bocas = {};
    this.hCabeza = null;
    this.hPecho = null;

    this.bocaEnReposo = 'feliz';
    this._paleta = 'uno';
    this._activeAction = null;
    this._bocaPuesta = null;

    this._habla = new Habla(THREE);   // lipsync + cabeceo, ver habla.js
  }

  async cargar({ onProgress } = {}) {
    const [gltfProfe] = await Promise.all([
      this._cargarGLTF(`${this.base}/profesora.glb?v=${Date.now()}`, onProgress),
      this._cargarCaras(`${this.base}/bocas.glb?v=${Date.now()}`, NOMBRES_BOCA, this.bocas),
    ]);
    if (gltfProfe) this._montarRobot(gltfProfe);
    this._montarCara();
    return this;
  }

  agregarA(scene) {
    if (this.model) scene.add(this.model);
  }

  // ------------------------------------------------------------ boca --

  ponerBoca(nombre) {
    if (this._bocaPuesta === nombre || !this.bocas[nombre]) return;
    this._bocaPuesta = nombre;
    for (const n in this.bocas) this.bocas[n].visible = (n === nombre);
  }

  aplicarGesto(nombreAnim) {
    const g = GESTO_DE_ANIM[nombreAnim];
    if (!g) return;
    this.ponerBoca(g.boca);
  }

  /** Pinta su CARA con la paleta de K-7, para que los dos tengan los ojos y
   *  la boca del mismo color en las tres paletas.
   *
   *  Aunque recorre el modelo entero, solo la cara cambia: sus ojos llevan a
   *  proposito los materiales 'M_navy' y 'M_white' (ver rig_profesora.py) y
   *  su boca sale de bocas.glb, que usa 'M_navy'. Esos son los unicos nombres
   *  suyos que paleta.js mapea a un rol -el resto lleva sufijo ('M_navy.002'
   *  la camisa, 'M_outline_profesora' el contorno)-, asi que su ropa se queda
   *  como esta. */
  aplicarPaletaCara(id) {
    this._paleta = id;
    if (this.model) aplicarPaleta(this.model, id);
  }

  // ---------------------------------------------------------- animaciones --

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

  hablar(activo) {
    this._habla.encender(activo);
  }

  // --------------------------------------------------------------- frame ---

  actualizar(dt) {
    // el cabeceo se deshace antes de que el mixer escriba: si no, se acumula
    // fotograma a fotograma (ver habla.js)
    this._habla.restaurar();
    this.mixer?.update(dt);
    if (this._habla.activo) this.ponerBoca(this._habla.aplicar(dt, this.bocaEnReposo));
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
            malla.castShadow = false;
            malla.receiveShadow = false;
            malla.frustumCulled = false;
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
      o.frustumCulled = false;

      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (/outline/i.test(m.name)) {
          m.side = THREE.FrontSide;
          m.polygonOffset = true;
          m.polygonOffsetFactor = 1;
        }
        if (/lens/i.test(m.name)) { m.transparent = true; m.opacity = 0.35; }
      }
    });

    this.model = model;
    this.hCabeza = model.getObjectByName('head');
    this.hPecho = model.getObjectByName('chest');
    this._habla.montar(this.hCabeza, this.hPecho);
    if (!this.hCabeza) this._onError('falta el hueso head en profesora.glb: se queda sin boca');

    if (gltf.animations.length) {
      this.mixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) {
        const a = this.mixer.clipAction(clip);
        if (UNA_VEZ.has(clip.name)) {
          a.setLoop(THREE.LoopOnce);
          a.clampWhenFinished = true;
        }
        a.setEffectiveWeight(clip.name === 'Profesora_Idle' ? 1 : 0);
        a.play();
        this.actions[clip.name] = a;
      }
      this._activeAction = this.actions['Profesora_Idle'] || null;

      this.mixer.addEventListener('finished', (e) => {
        if (UNA_VEZ.has(e.action.getClip().name)) this.reproducir('Profesora_Idle');
      });
    }
  }

  _montarCara() {
    if (!this.hCabeza || !this.bocas.feliz) return;
    if (this.bocas.feliz.parent !== this.hCabeza) {
      for (const n in this.bocas) this.hCabeza.add(this.bocas[n]);
      const { pos, escala } = BOCA_PROFESORA;
      for (const n in this.bocas) {
        this.bocas[n].position.set(...pos);
        this.bocas[n].scale.setScalar(escala);
      }
      this.ponerBoca('feliz');
    }
    // las bocas acaban de colgarse del hueso: entran con la paleta en curso
    if (this.model) aplicarPaleta(this.model, this._paleta);
  }

}

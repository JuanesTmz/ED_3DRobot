// Paletas intercambiables para los dos modelos de robot.glb.
//
// Los dos modelos son el MISMO personaje modelado dos veces, asi que cada
// material cumple la misma funcion en ambos (la bata, el acento, la tinta del
// contorno...). Eso permite describir el color por ROL en vez de por material
// y aplicar cualquiera de las dos paletas a cualquiera de los dos modelos.
//
// Los valores son RGB LINEAL, copiados tal cual del baseColorFactor del GLB:
// three trabaja en espacio lineal, asi que setRGB() los usa sin convertir y el
// resultado es identico al que exporto Blender.

// material del GLB -> rol que cumple
export const ROL_DE_MATERIAL = {
  // Modelo 1 (Qubi)
  M_magenta:  'base',      M_magenta_d: 'base_d',
  M_lime:     'acento',    M_lime_d:    'acento_d',
  M_green_sh: 'calzado',
  M_teal:     'bata',      M_teal_d:    'bata_d',
  M_navy:     'oscuro',    M_white:     'claro',
  M_yellow:   'amarillo',  M_orange:    'naranja',
  M_circuit:  'circuito',  M_lens:      'lente',
  M_outline:  'tinta',

  // Modelo 2 (CubeHead). No tiene material propio para el calzado ni para el
  // cristal de las gafas: sus zapatos van con el verde oscuro del acento.
  QB_rosado:  'base',      QB_rosado_d: 'base_d',
  QB_verde:   'acento',    QB_verde_d:  'acento_d',
  QB_azul:    'bata',      QB_azul_d:   'bata_d',
  QB_navy:    'oscuro',    QB_gris:     'claro',
  QB_amarillo:'amarillo',  QB_naranja:  'naranja',
  QB_circuito:'circuito',
  QB_outline: 'tinta',
};

// rol -> [r, g, b, factor_de_emision]
// El cuarto valor es cuanto del propio color se emite: mantiene el aspecto de
// color plano de ilustracion en lugar de degradados. Por defecto 0.2.
export const PALETAS = {
  uno: {
    nombre:   'Paleta 1',
    base:     [0.906, 0.267, 0.510],
    base_d:   [0.780, 0.180, 0.420],
    acento:   [0.588, 0.769, 0.180],
    acento_d: [0.451, 0.612, 0.129],
    calzado:  [0.298, 0.686, 0.490],
    bata:     [0.353, 0.596, 0.741],
    bata_d:   [0.243, 0.463, 0.612],
    oscuro:   [0.153, 0.204, 0.278],
    claro:    [0.960, 0.965, 0.975],
    amarillo: [0.965, 0.749, 0.110],
    naranja:  [0.937, 0.518, 0.157],
    circuito: [0.420, 0.800, 0.420],
    lente:    [0.741, 0.792, 0.910],
    tinta:    [0.153, 0.204, 0.278, 1.0],
  },
  dos: {
    nombre:   'Paleta 2',
    base:     [1.000, 0.105, 1.000],
    base_d:   [0.550, 0.058, 0.550],
    acento:   [0.076, 0.930, 0.002],
    acento_d: [0.042, 0.512, 0.001],
    calzado:  [0.042, 0.512, 0.001],
    bata:     [0.036, 0.521, 1.000],
    bata_d:   [0.020, 0.287, 0.550],
    oscuro:   [0.007, 0.104, 0.200],
    claro:    [0.800, 0.800, 0.800],
    amarillo: [0.973, 0.815, 0.002],
    naranja:  [1.000, 0.144, 0.006],
    circuito: [0.076, 0.930, 0.002, 0.45],
    lente:    [0.800, 0.800, 0.800],
    tinta:    [0.004, 0.063, 0.120, 1.0],
  },
};

const CLAVE = 'ed3d-paleta';

export function paletaGuardada() {
  try {
    const v = localStorage.getItem(CLAVE);
    return PALETAS[v] ? v : 'uno';
  } catch {
    return 'uno';   // localStorage bloqueado (file://, modo privado)
  }
}

export function guardarPaleta(id) {
  try { localStorage.setItem(CLAVE, id); } catch { /* da igual */ }
}

/** Repinta todos los materiales conocidos que cuelguen de `raiz`. */
export function aplicarPaleta(raiz, id) {
  const pal = PALETAS[id];
  if (!pal || !raiz) return;

  raiz.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      const rol = pal[ROL_DE_MATERIAL[m.name]];
      if (!rol) continue;
      const [r, g, b, k = 0.2] = rol;
      if (ROL_DE_MATERIAL[m.name] === 'tinta') {
        // el contorno es negro puro y solo tine por emision
        m.color.setRGB(0, 0, 0);
        m.emissive?.setRGB(r, g, b);
      } else {
        m.color.setRGB(r, g, b);
        m.emissive?.setRGB(r * k, g * k, b * k);
      }
    }
  });
}

/** Cablea un grupo de botones [data-pal] y devuelve el id activo. */
export function conectarBotones(selector, alCambiar) {
  const btns = [...document.querySelectorAll(selector)];
  const activo = paletaGuardada();
  const marcar = (id) => {
    for (const b of btns) b.setAttribute('aria-pressed', String(b.dataset.pal === id));
  };
  for (const b of btns) {
    b.addEventListener('click', () => {
      marcar(b.dataset.pal);
      guardarPaleta(b.dataset.pal);
      alCambiar(b.dataset.pal);
    });
  }
  marcar(activo);
  return activo;
}

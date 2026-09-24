// Color de K-7, por rol de material (no por nombre de material exacto): cada
// modelo del robot.glb original usa materiales distintos para la misma pieza
// (la bata, el acento, la tinta del contorno...), pero cumplen el mismo rol,
// asi que una sola paleta vale para cualquiera de ellos.
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
//
// Este proyecto fija a K-7 (y a la cara de la Profesora) en la Paleta 3: las
// paletas 1 y 2 del proyecto original no se trajeron, no hay selector.
export const PALETAS = {
  tres: {
    // Los 6 colores base son la conversion exacta (sRGB->lineal) de los
    // hex de la imagen, igual que en paleta uno/dos: sin ese paso three los
    // pintaria mal, porque trabaja en espacio lineal. La emision (4to valor,
    // por defecto 0.2) sube un poco mas que en las otras paletas -mismo
    // mecanismo que ya usa 'circuito' en la paleta dos- porque estos son
    // colores muy saturados y la luz de la escena + el tonemap los apagaba
    // bastante; el propio color base no se toca.
    nombre:   'Paleta 3',
    base:     [0.687, 0.084, 0.708, 0.38],
    base_d:   [0.563, 0.069, 0.581, 0.38],
    acento:   [0.078, 0.533, 0.216, 0.38],
    acento_d: [0.064, 0.437, 0.177, 0.38],
    calzado:  [0.064, 0.437, 0.177, 0.38],
    bata:     [0.080, 0.423, 0.687, 0.38],
    bata_d:   [0.066, 0.347, 0.563, 0.38],
    oscuro:   [0.014, 0.050, 0.067],
    claro:    [0.920, 0.930, 0.940],
    amarillo: [0.823, 0.651, 0.076, 0.38],
    naranja:  [0.784, 0.292, 0.054, 0.38],
    circuito: [0.078, 0.533, 0.216, 0.38],
    lente:    [0.586, 0.740, 0.859],
    // el contorno es el mismo de la paleta 1: el casi negro que tenia antes
    // (0.014, 0.050, 0.067) endurecia demasiado la silueta al lado del resto
    tinta:    [0.153, 0.204, 0.278, 1.0],
  },
};

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

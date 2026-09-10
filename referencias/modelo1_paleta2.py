"""
Modelo 1 (Qubi/K-7) con la paleta del modelo 2, riggeado y listo para posar.

    blender --background --python modelo1_paleta2.py

Reutiliza el mismo pipeline de siempre (build_character + rig_and_export) y
solo cambia dos cosas antes de construir:

  1. sustituye la paleta por la del modelo 2, rol por rol
  2. deja el archivo preparado para animar a mano, no para exportar:
     el idle se queda dentro como referencia pero SIN asignar al armature,
     asi el rig arranca en pose de reposo y las acciones nuevas no lo pisan

Salida: modelo1_paleta2.blend
"""

import os
import sys

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import build_character as bc      # noqa: E402
import rig_and_export as rig      # noqa: E402

OUT = os.path.join(HERE, "modelo1_paleta2.blend")

# ------------------------------------------------------------- paleta 2 ----
# Los mismos numeros que docs/paleta.js, en RGB lineal. Las claves son los
# nombres de color del modelo 1; el valor, el color que cumple ESE MISMO ROL
# en el modelo 2 (magenta->rosado, lima->verde, teal->azul...).
PALETA2 = {
    "magenta":   (1.000, 0.105, 1.000),   # base
    "magenta_d": (0.550, 0.058, 0.550),   # base en sombra
    "lime":      (0.076, 0.930, 0.002),   # acento
    "lime_d":    (0.042, 0.512, 0.001),   # acento en sombra
    "green_sh":  (0.042, 0.512, 0.001),   # el modelo 2 calza el mismo verde
    "teal":      (0.036, 0.521, 1.000),   # bata
    "teal_d":    (0.020, 0.287, 0.550),
    "navy":      (0.007, 0.104, 0.200),   # camisa, pupilas
    "white":     (0.800, 0.800, 0.800),
    "yellow":    (0.973, 0.815, 0.002),
    "orange":    (1.000, 0.144, 0.006),
    "circuit":   (0.076, 0.930, 0.002),
    "lens":      (0.800, 0.800, 0.800),   # el modelo 2 no tiene cristal propio
}

# El contorno del modelo 2 no usa el navy de la camisa: tira a un azul mas
# apagado y frio. Va aparte porque build_character lo saca de PALETTE["navy"].
TINTA = (0.004, 0.063, 0.120)

# Las lineas de circuito del modelo 2 brillan mas que el resto (0.45 en vez
# del 0.20 que llevan todos los materiales).
EMISION_CIRCUITO = 0.45


def ajustar_materiales():
    """Los dos retoques que no caben en la tabla de colores."""
    outline = bpy.data.materials.get("M_outline")
    if outline:
        bsdf = outline.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Emission Color"].default_value = (*TINTA, 1.0)
        outline.diffuse_color = (*TINTA, 1.0)

    circuito = bpy.data.materials.get("M_circuit")
    if circuito:
        bsdf = circuito.node_tree.nodes["Principled BSDF"]
        bsdf.inputs["Emission Strength"].default_value = EMISION_CIRCUITO


def main():
    # OJO: hay que repintar ANTES de construir. bc.mat() crea cada material la
    # primera vez que se pide y lo cachea, asi que despues ya seria tarde.
    bc.PALETTE.update(PALETA2)

    rig.build()
    rig.flatten_transforms()
    rig.bake_outlines()
    rig.assign_weights()
    arm = rig.build_armature()
    mesh = rig.join_and_bind(arm)
    accion = rig.build_idle(arm)

    ajustar_materiales()

    mesh.name = "Modelo1"
    mesh.data.name = "Modelo1Mesh"

    # el idle sobrevive en el archivo (fake user) pero sale del armature
    accion.use_fake_user = True
    arm.animation_data.action = None

    arm.show_in_front = True          # huesos visibles a traves de la malla
    arm.data.display_type = "OCTAHEDRAL"

    # luces y camara: el archivo es para trabajar, no para exportar
    bc.setup_lighting()
    cam = bc.setup_camera()
    bc.aim(cam, (2.6, -4.4, 1.9))

    bpy.context.scene.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=OUT)

    print("\n" + "=" * 56)
    print(f"  malla            : {mesh.name}  ({len(mesh.data.polygons)} caras, "
          f"{len(mesh.data.materials)} materiales)")
    print(f"  armature         : {arm.name}  ({len(arm.data.bones)} huesos)")
    print(f"  huesos           : {', '.join(b.name for b in arm.data.bones)}")
    print(f"  accion guardada  : {accion.name} (sin asignar, fake user)")
    print(f"  rango            : {bpy.context.scene.frame_start}-"
          f"{bpy.context.scene.frame_end} @ {bpy.context.scene.render.fps} fps")
    print(f"  -> {OUT}  ({os.path.getsize(OUT) / 1024:.0f} KB)")
    print("=" * 56)


if __name__ == "__main__":
    main()

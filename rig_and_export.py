"""
Optimiza, riggea y exporta el robot para three.js.

    blender --background --python rig_and_export.py

Pipeline:
  1. Construye el personaje (reutiliza build_character.py)
  2. Desemparenta, aplica rotacion+escala (mata las escalas X negativas)
  3. Recalcula normales hacia fuera
  4. Aplica el contorno (solidify) para hornearlo en la geometria
  5. Asigna un vertex group por pieza, peso 1.0 -> skinning rigido
  6. Crea el armature (15 huesos)
  7. Une TODO en una sola malla skinned
  8. Anima un idle ciclico de 2.5 s
  9. Exporta robot_rigged.glb

Salida: web/robot_rigged.glb
"""

import bpy
import os
import sys
import math

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

import build_character as bc


# ------------------------------------------------------- mapa hueso/pieza ---
# Se evalua en orden: el primer prefijo que casa gana. Por eso las piezas
# mas especificas (coat_flap) van antes que las genericas (coat).
BONE_OF_PREFIX = [
    # cabeza: todo el bloque isometrico + gafas + boca
    ("hat_",        "head"),
    ("head_",       "head"),
    ("rim_",        "head"),
    ("lens_",       "head"),
    ("eye_",        "head"),
    ("gleam_",      "head"),
    ("bridge",      "head"),
    ("temple_",     "head"),
    ("mouth_",      "head"),

    # brazos (mano antes que 'hat_'/'head_' ya resueltos arriba)
    ("arm_upper_L", "upperarm_L"),
    ("arm_upper_R", "upperarm_R"),
    ("arm_fore_L",  "forearm_L"),
    ("arm_fore_R",  "forearm_R"),
    ("cuff_L",      "forearm_L"),
    ("cuff_R",      "forearm_R"),
    ("hand_L",      "hand_L"),
    ("hand_R",      "hand_R"),
    ("finger_L",    "hand_L"),
    ("finger_R",    "hand_R"),
    ("thumb_L",     "hand_L"),
    ("thumb_R",     "hand_R"),

    # piernas
    ("leg_upper_L", "thigh_L"),
    ("leg_upper_R", "thigh_R"),
    ("leg_lower_L", "shin_L"),
    ("leg_lower_R", "shin_R"),
    ("shoe_tip_L",  "foot_L"),
    ("shoe_tip_R",  "foot_R"),
    ("shoe_L",      "foot_L"),
    ("shoe_R",      "foot_R"),
    ("sole_L",      "foot_L"),
    ("sole_R",      "foot_R"),

    # torso: los vuelos de la bata cuelgan de la cadera para que se muevan
    # con ella; el resto de la bata va al pecho
    ("coat_flap_",  "hips"),
    ("coat_",       "chest"),
    ("lapel_",      "chest"),
    ("patch_",      "chest"),
    ("circuit_",    "chest"),
    ("shirt",       "chest"),
    ("neck",        "chest"),
]


def bone_for(name):
    for prefix, bone in BONE_OF_PREFIX:
        if name.startswith(prefix):
            return bone
    raise RuntimeError(f"pieza sin hueso asignado: {name}")


# --------------------------------------------------------------- esqueleto --
# (nombre, cabeza, cola, padre). El hueso root apunta en +Y para que sus
# ejes locales coincidan con los del mundo: asi el rebote vertical es
# simplemente location.z y no hay que pensar en espacio de hueso.
BONES = [
    ("root",       (0.000,  0.00, 0.000), (0.000, 0.15, 0.000), None),
    ("hips",       (0.000,  0.00, 0.440), (0.000, 0.00, 0.620), "root"),
    ("spine",      (0.000,  0.00, 0.620), (0.000, 0.00, 0.850), "hips"),
    ("chest",      (0.000,  0.00, 0.850), (0.000, 0.00, 1.050), "spine"),
    ("head",       (0.000,  0.00, 1.050), (0.000, 0.00, 1.900), "chest"),

    ("upperarm_L", (0.300,  0.00, 1.010), (0.325, 0.00, 0.720), "chest"),
    ("forearm_L",  (0.325,  0.00, 0.720), (0.350, 0.00, 0.470), "upperarm_L"),
    ("hand_L",     (0.350,  0.00, 0.470), (0.355, -0.05, 0.330), "forearm_L"),
    ("upperarm_R", (-0.300, 0.00, 1.010), (-0.325, 0.00, 0.720), "chest"),
    ("forearm_R",  (-0.325, 0.00, 0.720), (-0.350, 0.00, 0.470), "upperarm_R"),
    ("hand_R",     (-0.350, 0.00, 0.470), (-0.355, -0.05, 0.330), "forearm_R"),

    ("thigh_L",    (0.118,  0.00, 0.450), (0.118, 0.00, 0.250), "hips"),
    ("shin_L",     (0.118,  0.00, 0.250), (0.118, 0.00, 0.105), "thigh_L"),
    ("foot_L",     (0.118,  0.00, 0.105), (0.118, -0.20, 0.045), "shin_L"),
    ("thigh_R",    (-0.118, 0.00, 0.450), (-0.118, 0.00, 0.250), "hips"),
    ("shin_R",     (-0.118, 0.00, 0.250), (-0.118, 0.00, 0.105), "thigh_R"),
    ("foot_R",     (-0.118, 0.00, 0.105), (-0.118, -0.20, 0.045), "shin_R"),
]


def meshes():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def select(objs, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or (objs[0] if objs else None)


# ================================================================ 1. build ==

def build():
    bc.reset_scene()
    root = bc.empty("QUBI_RIG_ROOT", (0, 0, 0))
    bc.build_legs(root)
    body = bc.build_body(root)
    arms = bc.build_arms(root)
    bc.build_head(root)
    body.location.z -= 0.09
    arms.location.z -= 0.09
    bpy.context.view_layer.update()


# ========================================================== 2-4. optimizar ==

def flatten_transforms():
    """Desemparenta, aplica rot/escala y arregla las normales invertidas."""
    ms = meshes()
    select(ms)
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")

    # Las piezas espejadas tienen escala X negativa: al aplicarla, el winding
    # queda invertido. Todas las formas son convexas y cerradas, asi que
    # recalcular normales hacia fuera es seguro y las deja bien.
    select(ms)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    select(ms)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    for e in [o for o in bpy.data.objects if o.type == "EMPTY"]:
        bpy.data.objects.remove(e, do_unlink=True)


def bake_outlines():
    """Anade el contorno y lo hornea (ya no hay escalas no uniformes)."""
    bc.add_outlines(thickness=0.019)
    for ob in meshes():
        bpy.context.view_layer.objects.active = ob
        for mod in list(ob.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)


# ============================================ 5. vertex groups (skin rigido) ==

def assign_weights():
    """Cada pieza -> un vertex group con peso 1.0. Una sola influencia por
    vertice = deformacion perfectamente rigida, identica al bone parenting."""
    counts = {}
    for ob in meshes():
        bone = bone_for(ob.name)
        vg = ob.vertex_groups.new(name=bone)
        vg.add(range(len(ob.data.vertices)), 1.0, "REPLACE")
        counts[bone] = counts.get(bone, 0) + 1
    return counts


# ============================================================ 6. armature ===

def build_armature():
    bpy.ops.object.armature_add(enter_editmode=False, location=(0, 0, 0))
    arm = bpy.context.object
    arm.name = "QUBI_Armature"
    arm.data.name = "QUBI_Skeleton"

    bpy.ops.object.mode_set(mode="EDIT")
    eb = arm.data.edit_bones
    for b in list(eb):
        eb.remove(b)
    for name, head, tail, parent in BONES:
        b = eb.new(name)
        b.head, b.tail = head, tail
        b.use_connect = False
        if parent:
            b.parent = eb[parent]
    bpy.ops.object.mode_set(mode="OBJECT")
    return arm


# ================================================== 7. unir + emparentar ====

def join_and_bind(arm):
    ms = meshes()
    # La malla activa marca el nombre final y el orden de los materiales.
    body = next(o for o in ms if o.name == "shirt")
    select(ms, active=body)
    bpy.ops.object.join()
    mesh = bpy.context.object
    mesh.name = "Qubi"
    mesh.data.name = "QubiMesh"

    # ARMATURE_NAME = usa los vertex groups que ya existen, sin recalcular
    # pesos automaticos (que arruinarian el caracter rigido).
    select([mesh, arm], active=arm)
    bpy.ops.object.parent_set(type="ARMATURE_NAME")
    return mesh


# ============================================================ 8. animacion ==

def build_idle(arm, fps=24, length=60):
    """Idle ciclico: respiracion, rebote y balanceo suave.
    Los fotogramas 0 y `length` son identicos para que el bucle no salte."""
    scene = bpy.context.scene
    scene.render.fps = fps
    scene.frame_start, scene.frame_end = 0, length

    for pb in arm.pose.bones:
        pb.rotation_mode = "XYZ"

    # (hueso, data_path, indice, [valores en 0, 1/4, 1/2, 3/4, 1])
    tracks = [
        ("root",       "location",        2, [0.0, 0.022, 0.0, -0.014, 0.0]),
        ("chest",      "rotation_euler",  0, [0.0, 0.030, 0.0, -0.020, 0.0]),
        ("head",       "rotation_euler",  1, [0.0, 0.110, 0.0, -0.110, 0.0]),
        ("head",       "rotation_euler",  0, [0.0, -0.050, 0.0, 0.045, 0.0]),
        ("upperarm_L", "rotation_euler",  0, [0.0, 0.120, 0.0, -0.090, 0.0]),
        ("upperarm_R", "rotation_euler",  0, [0.0, -0.090, 0.0, 0.120, 0.0]),
        ("forearm_L",  "rotation_euler",  0, [0.0, 0.070, 0.0, -0.050, 0.0]),
        ("forearm_R",  "rotation_euler",  0, [0.0, -0.050, 0.0, 0.070, 0.0]),
    ]

    arm.animation_data_create()
    action = bpy.data.actions.new("Idle")
    arm.animation_data.action = action

    frames = [0, length // 4, length // 2, 3 * length // 4, length]
    for bone, path, idx, values in tracks:
        pb = arm.pose.bones[bone]
        for f, v in zip(frames, values):
            if path == "location":
                pb.location[idx] = v
            else:
                pb.rotation_euler[idx] = v
            pb.keyframe_insert(data_path=path, index=idx, frame=f)

    for fc in action.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
    return action


# =============================================================== 9. export ==

def export(arm, mesh):
    out_dir = os.path.join(HERE, "web")
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, "robot_rigged.glb")

    select([mesh, arm], active=arm)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,          # deja fuera camara y luces
        export_apply=False,          # los modificadores ya estan horneados
        export_animations=True,
        export_skins=True,
        export_yup=True,             # convencion de three.js
    )
    return path


# ================================================================== main ====

def main():
    build()
    n_before = len(meshes())

    flatten_transforms()
    bake_outlines()
    counts = assign_weights()
    arm = build_armature()
    mesh = join_and_bind(arm)
    build_idle(arm)
    path = export(arm, mesh)

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "robot_rigged.blend"))

    print("\n" + "=" * 52)
    print(f"  piezas de origen : {n_before}")
    print(f"  mallas finales   : {len(meshes())}")
    print(f"  materiales       : {len(mesh.data.materials)}")
    print(f"  triangulos       : {len(mesh.data.loop_triangles)}")
    print(f"  huesos           : {len(arm.data.bones)}")
    print(f"  vertex groups    : {len(mesh.vertex_groups)}")
    print(f"  piezas por hueso : {counts}")
    print(f"  -> {path}")
    print("=" * 52)


if __name__ == "__main__":
    main()

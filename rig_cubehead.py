"""Riggea el CubeHead con el esqueleto del robot original y exporta los dos
modelos en un solo GLB.

    blender -b robot_cubehead_solo.blend -P rig_cubehead.py

Entrada : robot_cubehead_solo.blend  (piezas sueltas, sin rig)
          docs/robot_rigged.glb      (armature QUBI + malla Qubi + accion Idle)
Salida  : docs/robot.glb             (armature + Qubi + QubiCube + Idle)

Las dos mallas quedan skinneadas al MISMO armature, asi que comparten rig y
animacion: el visor solo alterna la visibilidad de una u otra y el idle sigue
corriendo sin cortes.

Sigue el mismo pipeline que rig_and_export.py del robot original: aplicar
transformaciones, recalcular normales, hornear el contorno con grosor de mundo
uniforme y un vertex group por pieza con peso 1.0 (skinning rigido).
"""

import os
import bpy

HERE = os.path.dirname(os.path.abspath(bpy.data.filepath))
RIGGED = os.path.join(HERE, "docs", "robot_rigged.glb")
OUT = os.path.join(HERE, "docs", "robot.glb")

OUTLINE_THICKNESS = 0.019  # el mismo valor que usa el robot original

# nombres de los nodos que el visor alterna
MESH_1 = "Modelo1"  # robot original
MESH_2 = "Modelo2"  # CubeHead

# Se evalua en orden: el primer prefijo que casa gana. Por eso las piezas mas
# especificas (coat_flap) van antes que las genericas (coat).
BONE_OF_PREFIX = [
    ("CubeHead",    "head"),
    ("rim_",        "head"),
    ("eye_",        "head"),
    ("gleam_",      "head"),
    ("bridge",      "head"),
    ("mouth_",      "head"),

    ("arm_upper_L", "upperarm_L"),
    ("arm_upper_R", "upperarm_R"),
    ("arm_fore_L",  "forearm_L"),
    ("arm_fore_R",  "forearm_R"),
    ("cuff_L",      "forearm_L"),
    ("cuff_R",      "forearm_R"),
    ("hand_L",      "hand_L"),
    ("hand_R",      "hand_R"),
    ("thumb_L",     "hand_L"),
    ("thumb_R",     "hand_R"),

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

    # los vuelos de la bata cuelgan de la cadera para que se muevan con ella
    ("coat_flap_",  "hips"),
    ("coat_",       "chest"),
    ("lapel_",      "chest"),
    ("patch_",      "chest"),
    ("circuit_",    "chest"),
    ("shirt",       "chest"),
    ("neck",        "chest"),
]


def bone_for(name):
    base = name[:-3] if name.endswith("_QB") else name
    for prefix, bone in BONE_OF_PREFIX:
        if base.startswith(prefix):
            return bone
    raise RuntimeError(f"pieza sin hueso asignado: {name}")


def meshes():
    # sobre la escena, no sobre bpy.data: el .blend trae objetos huerfanos que
    # no estan enlazados y no deben entrar en el join
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def select(objs, active=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = active or (objs[0] if objs else None)


# =========================================================== 1. limpiar =====

def strip_scene():
    """Fuera camara y luces: el visor pone las suyas."""
    for o in [o for o in bpy.data.objects if o.type in {"CAMERA", "LIGHT"}]:
        bpy.data.objects.remove(o, do_unlink=True)


# ================================================== 2. aplanar transforms ===

def flatten_transforms():
    """Desemparenta, aplica rot/escala y arregla las normales invertidas.

    Hay que aplicar la escala ANTES de hornear el solidify: si no, el grosor
    del contorno se deforma con la escala no uniforme de cada pieza."""
    ms = meshes()
    select(ms)
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")

    # Las piezas espejadas tienen escala X negativa: al aplicarla el winding
    # queda invertido. Todas las formas son convexas y cerradas, asi que
    # recalcular normales hacia fuera es seguro.
    select(ms)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    select(ms)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    for e in [o for o in bpy.data.objects if o.type == "EMPTY"]:
        bpy.data.objects.remove(e, do_unlink=True)


# ======================================================= 3. contorno ========

def bake_outlines():
    """Regraba el grosor en unidades de mundo y hornea el solidify."""
    for ob in meshes():
        bpy.context.view_layer.objects.active = ob
        for mod in list(ob.modifiers):
            if mod.type == "SOLIDIFY":
                mod.thickness = OUTLINE_THICKNESS
            bpy.ops.object.modifier_apply(modifier=mod.name)


# ============================================ 4. vertex groups (skin rigido) =

def assign_weights():
    """Cada pieza -> un vertex group con peso 1.0. Una sola influencia por
    vertice = deformacion rigida, identica al bone parenting."""
    counts = {}
    for ob in meshes():
        bone = bone_for(ob.name)
        vg = ob.vertex_groups.new(name=bone)
        vg.add(range(len(ob.data.vertices)), 1.0, "REPLACE")
        counts[bone] = counts.get(bone, 0) + 1
    return counts


# =========================================== 5. traer el rig del robot 1 ====

def import_rigged():
    """Importa docs/robot_rigged.glb. Devuelve (nombre armature, nombre malla).

    Todo va por NOMBRE: los operadores de import y `objects.remove()` realojan
    la tabla de objetos, asi que una referencia guardada de antes puede acabar
    apuntando a otro objeto (y renombrar el que no toca)."""
    before = {o.name for o in bpy.data.objects}
    bpy.ops.import_scene.gltf(filepath=RIGGED)
    new = [o.name for o in bpy.data.objects if o.name not in before]

    # el importador cuelga todo de un empty de conversion de ejes: sobra
    for name in list(new):
        ob = bpy.data.objects.get(name)
        if ob and ob.type == "EMPTY":
            bpy.data.objects.remove(ob, do_unlink=True)
            new.remove(name)

    arm_name = next(n for n in new if bpy.data.objects[n].type == "ARMATURE")

    # No basta con "la primera malla nueva": el .blend arrastra un Icosphere
    # huerfano que reaparece al importar. La malla buena es la que esta
    # deformada por el armature recien importado.
    def skinned_by_arm(n):
        ob = bpy.data.objects[n]
        return ob.type == "MESH" and any(
            m.type == "ARMATURE" and m.object and m.object.name == arm_name
            for m in ob.modifiers
        )

    mesh_name = next(n for n in new if skinned_by_arm(n))

    bpy.data.objects[arm_name].parent = None
    ob = bpy.data.objects[mesh_name]
    ob.name = MESH_1
    ob.data.name = MESH_1 + "Mesh"
    return arm_name, MESH_1


# ================================================= 6. unir + emparentar =====

def join_and_bind(arm_name, exclude):
    ms = [o for o in meshes() if o.name != exclude]
    # La malla activa marca el nombre final y el orden de los materiales.
    body = next(o for o in ms if o.name.startswith("shirt"))
    select(ms, active=body)
    bpy.ops.object.join()
    mesh = bpy.context.object
    mesh.name = MESH_2
    mesh.data.name = MESH_2 + "Mesh"

    # ARMATURE_NAME = usa los vertex groups que ya existen, sin recalcular
    # pesos automaticos (que arruinarian el caracter rigido).
    select([bpy.data.objects[MESH_2], bpy.data.objects[arm_name]],
           active=bpy.data.objects[arm_name])
    bpy.ops.object.parent_set(type="ARMATURE_NAME")
    return MESH_2


# ================================================================ 7. export =

def export():
    # sin use_selection: a estas alturas la escena ya solo tiene el armature y
    # las dos mallas, y las referencias a objetos sobreviven mal a los
    # operadores de import/join
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        use_selection=False,
        export_apply=False,          # los modificadores ya estan horneados
        export_animations=True,
        export_skins=True,
        export_yup=True,             # convencion de three.js
    )


def main():
    strip_scene()
    n_pieces = len(meshes())

    flatten_transforms()
    bake_outlines()
    counts = assign_weights()

    arm_name, qubi_name = import_rigged()
    cube_name = join_and_bind(arm_name, exclude=qubi_name)

    export()

    arm = bpy.data.objects[arm_name]
    qubi = bpy.data.objects[qubi_name]
    cube = bpy.data.objects[cube_name]
    action = arm.animation_data.action if arm.animation_data else None

    print("\n" + "=" * 56)
    print(f"  piezas CubeHead  : {n_pieces}")
    print(f"  huesos           : {len(arm.data.bones)}")
    print(f"  vertex groups    : {len(cube.vertex_groups)}")
    print(f"  piezas por hueso : {counts}")
    print(f"  accion           : {action.name if action else 'NINGUNA'}")
    print(f"  {qubi.name:16} : {len(qubi.data.polygons)} caras, "
          f"{len(qubi.data.materials)} materiales")
    print(f"  {cube.name:16} : {len(cube.data.polygons)} caras, "
          f"{len(cube.data.materials)} materiales")
    print(f"  -> {OUT}  ({os.path.getsize(OUT) / 1024:.0f} KB)")
    print("=" * 56)


if __name__ == "__main__":
    main()

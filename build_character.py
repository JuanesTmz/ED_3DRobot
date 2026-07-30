"""
Modelado low-poly del personaje "Qubi" (concept art Proyecto S&T).

Uso:
    blender --background --python build_character.py

Genera:
    robot.blend
    preview_front.png / preview_34.png / preview_side.png
"""

import bpy
import bmesh
import math
import os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- paleta ----
# Muestreada del concept art.
PALETTE = {
    "magenta":   (0.906, 0.267, 0.510),   # cabeza / montura de gafas
    "magenta_d": (0.780, 0.180, 0.420),   # magenta en sombra (cara lateral)
    "lime":      (0.588, 0.769, 0.180),   # verde del "sombrero"
    "lime_d":    (0.451, 0.612, 0.129),
    "yellow":    (0.965, 0.749, 0.110),   # bloques amarillos / manos
    "orange":    (0.937, 0.518, 0.157),   # barra naranja superior
    "teal":      (0.353, 0.596, 0.741),   # bata de laboratorio
    "teal_d":    (0.243, 0.463, 0.612),
    "navy":      (0.153, 0.204, 0.278),   # camisa, contornos, pupilas
    "lens":      (0.741, 0.792, 0.910),   # cristal de las gafas
    "white":     (0.960, 0.965, 0.975),
    "green_sh":  (0.298, 0.686, 0.490),   # zapatos
    "circuit":   (0.420, 0.800, 0.420),   # lineas de circuito
}


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.film_transparent = False
    # AgX (default en 4.x) desatura los colores planos del concept art.
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.world = bpy.data.worlds.new("World")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (0.90, 0.92, 0.95, 1.0)
    bg.inputs[1].default_value = 0.28


MATS = {}


def mat(name):
    """Material plano estilo cel/flat, cacheado por nombre de color."""
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(f"M_{name}")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    r, g, b = PALETTE[name]
    bsdf.inputs["Base Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.92
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Specular IOR Level"].default_value = 0.15
    # Emision tenue del propio color: levanta las sombras y mantiene el
    # aspecto de color plano de ilustracion en lugar de degradados.
    bsdf.inputs["Emission Color"].default_value = (r, g, b, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 0.20
    if name == "lens":
        bsdf.inputs["Roughness"].default_value = 0.12
        bsdf.inputs["Alpha"].default_value = 0.20
        bsdf.inputs["Emission Strength"].default_value = 0.05
        m.blend_method = "BLEND"
    m.diffuse_color = (r, g, b, 1.0)   # color en viewport solido
    MATS[name] = m
    return m


OUTLINE_MAT = None


def outline_material():
    """Material negro con backface culling para la tecnica de inverted hull."""
    global OUTLINE_MAT
    if OUTLINE_MAT:
        return OUTLINE_MAT
    m = bpy.data.materials.new("M_outline")
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    ink = PALETTE["navy"]
    bsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
    bsdf.inputs["Emission Color"].default_value = (*ink, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 1.0
    m.use_backface_culling = True   # clave: solo se ve la silueta
    m.diffuse_color = (*ink, 1.0)
    OUTLINE_MAT = m
    return m


def add_outlines(thickness=0.012):
    """Contorno estilo ilustracion: cascara invertida sobre cada malla."""
    for ob in bpy.data.objects:
        if ob.type != "MESH" or ob.name.startswith("lens_"):
            continue
        ob.data.materials.append(outline_material())
        idx = len(ob.data.materials) - 1
        # La escala no uniforme de las cajas deformaria el grosor: se
        # compensa con el eje de mayor escala.
        s = max(abs(v) for v in ob.scale)
        mod = ob.modifiers.new("outline", "SOLIDIFY")
        mod.thickness = thickness / max(s, 1e-4)
        mod.offset = 1.0
        mod.use_flip_normals = True
        mod.use_rim = False
        mod.material_offset = idx
        mod.material_offset_rim = idx


# ------------------------------------------------------------ primitivas ----

def box(name, size, loc, color, rot=(0, 0, 0), parent=None):
    """Caja low-poly (6 caras) con pivote en su centro."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = Vector(size)
    ob.rotation_euler = rot
    ob.data.materials.append(mat(color))
    _finish(ob, parent)
    return ob


def cyl(name, radius, depth, loc, color, verts=12, rot=(0, 0, 0), parent=None):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot
    )
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(mat(color))
    _finish(ob, parent)
    return ob


def ring(name, radius, thickness, depth, loc, color, verts=14, rot=(0, 0, 0), parent=None):
    """Anillo low-poly: cilindro exterior menos cilindro interior."""
    outer = cyl(name, radius, depth, loc, color, verts=verts, rot=rot)
    inner = cyl(f"{name}_cut", radius - thickness, depth * 2.0, loc, color,
                verts=verts, rot=rot)
    m = outer.modifiers.new("hole", "BOOLEAN")
    m.operation = "DIFFERENCE"
    m.object = inner
    bpy.context.view_layer.objects.active = outer
    bpy.ops.object.modifier_apply(modifier="hole")
    bpy.data.objects.remove(inner, do_unlink=True)
    _finish(outer, parent)
    return outer


def sphere(name, radius, loc, color, parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=8,
                                         radius=radius, location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.data.materials.append(mat(color))
    _finish(ob, parent)
    return ob


def _finish(ob, parent):
    """Shading plano (low-poly) + parentesco sin alterar la transformada."""
    for p in ob.data.polygons:
        p.use_smooth = False
    if parent is not None:
        ob.parent = parent
        ob.matrix_parent_inverse = parent.matrix_world.inverted()


def empty(name, loc=(0, 0, 0), parent=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = 0.15
    e.location = loc
    bpy.context.collection.objects.link(e)
    if parent:
        e.parent = parent
    return e


def mirror_x(ob, parent=None):
    """Duplica un objeto espejado en X (para brazos/piernas/ojos)."""
    dup = ob.copy()
    dup.data = ob.data.copy()
    dup.name = ob.name.replace("_L", "_R")
    bpy.context.collection.objects.link(dup)
    dup.location.x = -ob.location.x
    dup.scale.x = -ob.scale.x
    dup.rotation_euler = (ob.rotation_euler[0], -ob.rotation_euler[1], -ob.rotation_euler[2])
    if parent:
        dup.parent = parent
    return dup


# =============================================================== CABEZA =====
# La cabeza del concept es un ensamblaje isometrico de bloques rectangulares
# tipo "objeto imposible": cara magenta, alas amarilla/verde y un techo
# verde lima con barras naranja y amarilla encastradas.

def build_head(root):
    head = empty("HEAD", (0, 0, 0), root)

    # --- volumen principal de la cara -------------------------------------
    box("head_face",      (0.62, 0.46, 0.58), (0.00, -0.06, 1.62), "magenta",   parent=head)
    box("head_back",      (0.74, 0.30, 0.54), (0.00,  0.24, 1.60), "magenta_d", parent=head)

    # --- ala izquierda: bloque amarillo en L ------------------------------
    # Alas y cara comparten el mismo rango vertical (1.33 - 1.87): si no,
    # el fondo se cuela por las esquinas superiores.
    box("head_wing_L",    (0.20, 0.54, 0.54), (-0.38, 0.00, 1.60), "yellow", parent=head)
    box("head_wing_Lb",   (0.32, 0.36, 0.14), (-0.30, -0.10, 1.31), "yellow", parent=head)

    # --- ala derecha: bloque verde ----------------------------------------
    box("head_wing_R",    (0.22, 0.50, 0.54), (0.38, 0.02, 1.60), "lime",   parent=head)
    box("head_wing_Rb",   (0.26, 0.34, 0.13), (0.32, -0.10, 1.32), "lime_d", parent=head)

    # --- "techo" verde con barras encastradas -----------------------------
    box("hat_slab",       (0.96, 0.64, 0.26), (0.00, -0.02, 2.00), "lime",   parent=head)
    box("hat_bar_orange", (0.48, 0.18, 0.14), (0.12, -0.24, 2.10), "orange", parent=head)
    box("hat_bar_yellow", (0.26, 0.30, 0.14), (-0.27, 0.10, 2.10), "yellow", parent=head)
    box("hat_bar_mag",    (0.20, 0.20, 0.13), (0.35,  0.18, 2.10), "magenta", parent=head)
    # borde frontal del techo, sobresale como visera
    box("hat_lip",        (0.96, 0.10, 0.10), (0.00, -0.33, 1.94), "lime_d", parent=head)

    # --- gafas -------------------------------------------------------------
    build_glasses(head)

    build_mouth(head)

    # La cabeza se asienta sobre el cuello (el concept no deja hueco).
    head.location.z = -0.23
    return head


def build_mouth(head):
    """Sonrisa low-poly: segmentos siguiendo una parabola abierta hacia arriba."""
    y = -0.298
    z0, k, half = 1.415, 1.55, 0.115
    n = 5
    for i in range(n):
        t = -half + (2 * half) * i / (n - 1)
        z = z0 + k * t * t
        slope = 2 * k * t                      # dz/dx -> giro tangente
        seg = 2 * half / (n - 1) * 1.35
        box(f"mouth_{i}", (seg, 0.045, 0.042), (t, y, z), "navy",
            rot=(0, -math.atan(slope), 0), parent=head)


def build_glasses(head):
    # La cara magenta llega hasta y = -0.29; todo el ojo va POR DELANTE de
    # ese plano o queda sepultado dentro de la caja.
    eye_x, eye_z = 0.175, 1.655
    y_rim, y_lens, y_gleam, y_pupil = -0.318, -0.312, -0.316, -0.302
    r_rim = 0.155

    rot_x = (math.radians(90), 0, 0)

    for sx, tag in ((1, "L"), (-1, "R")):
        x = sx * eye_x
        ring(f"rim_{tag}", r_rim, 0.032, 0.055, (x, y_rim, eye_z), "magenta",
             verts=16, rot=rot_x, parent=head)
        cyl(f"lens_{tag}", r_rim - 0.03, 0.014, (x, y_lens, eye_z), "lens",
            verts=16, rot=rot_x, parent=head)
        # ojo: pupila grande + dos brillos, estilo del concept
        cyl(f"eye_{tag}", 0.092, 0.016, (x, y_pupil, eye_z), "navy",
            verts=14, rot=rot_x, parent=head)
        cyl(f"gleam_a_{tag}", 0.034, 0.012, (x - sx * 0.028, y_gleam, eye_z + 0.032),
            "white", verts=10, rot=rot_x, parent=head)
        cyl(f"gleam_b_{tag}", 0.018, 0.012, (x + sx * 0.032, y_gleam, eye_z - 0.034),
            "white", verts=8, rot=rot_x, parent=head)

    # puente
    box("bridge", (0.09, 0.03, 0.030), (0.0, y_rim, eye_z), "magenta", parent=head)
    # patillas hacia atras
    for sx, tag in ((1, "L"), (-1, "R")):
        box(f"temple_{tag}", (0.03, 0.42, 0.026),
            (sx * 0.315, -0.10, eye_z + 0.02), "magenta", parent=head)


# ================================================================ CUERPO ====
# Bata de laboratorio abierta, camisa oscura, remiendos de color y lineas
# de circuito impresas.

def build_body(root):
    body = empty("BODY", (0, 0, 0), root)

    # camisa / torso interior
    box("shirt", (0.36, 0.26, 0.48), (0.0, 0.0, 0.85), "navy", parent=body)

    # cuello (corto: la cabeza se apoya casi directamente sobre los hombros)
    box("neck", (0.22, 0.20, 0.14), (0.0, -0.02, 1.14), "magenta_d", parent=body)

    # --- bata: dos paneles frontales + espalda, ligeramente abiertos -------
    for sx, tag in ((1, "L"), (-1, "R")):
        box(f"coat_front_{tag}", (0.17, 0.10, 0.60), (sx * 0.145, -0.155, 0.82),
            "teal", rot=(0, sx * math.radians(-4), 0), parent=body)
        box(f"coat_side_{tag}", (0.08, 0.30, 0.60), (sx * 0.225, -0.01, 0.82),
            "teal_d", parent=body)
        # solapa
        box(f"lapel_{tag}", (0.09, 0.06, 0.19), (sx * 0.125, -0.19, 1.01),
            "white", rot=(0, sx * math.radians(-10), 0), parent=body)
        # faldon: dos vuelos separados, para que se vean las piernas en medio
        box(f"coat_flap_{tag}", (0.24, 0.34, 0.16), (sx * 0.175, -0.01, 0.56),
            "teal", rot=(0, sx * math.radians(-6), 0), parent=body)

    box("coat_back", (0.54, 0.10, 0.60), (0.0, 0.145, 0.82), "teal", parent=body)

    # --- remiendos de color del concept ------------------------------------
    box("patch_lime",   (0.11, 0.02, 0.19), (0.180, -0.208, 0.74), "lime",    parent=body)
    box("patch_yellow", (0.09, 0.02, 0.12), (-0.175, -0.208, 0.93), "yellow", parent=body)
    box("patch_mag",    (0.07, 0.02, 0.09), (0.175, -0.208, 1.01), "magenta", parent=body)
    box("patch_lime2",  (0.14, 0.02, 0.10), (-0.20, 0.20, 0.64), "lime_d",    parent=body)

    # --- lineas de circuito impresas en la bata ----------------------------
    circuit = [
        ((0.012, 0.012, 0.18), (-0.205, -0.212, 0.78), (0, 0, 0)),
        ((0.12, 0.012, 0.012), (-0.150, -0.212, 0.69), (0, 0, 0)),
        ((0.012, 0.012, 0.11), (-0.095, -0.212, 0.735), (0, 0, 0)),
        ((0.09, 0.012, 0.012), (0.175, -0.212, 0.88), (0, 0, 0)),
        ((0.012, 0.012, 0.13), (0.215, -0.212, 0.94), (0, 0, 0)),
    ]
    for i, (s, l, r) in enumerate(circuit):
        box(f"circuit_{i}", s, l, "circuit", rot=r, parent=body)
    for i, (x, z) in enumerate([(-0.205, 0.87), (-0.095, 0.79), (0.215, 1.005)]):
        cyl(f"circuit_node_{i}", 0.022, 0.014, (x, -0.212, z), "circuit",
            verts=8, rot=(math.radians(90), 0, 0), parent=body)

    return body


# =============================================================== BRAZOS =====

def build_arms(root):
    arms = empty("ARMS", (0, 0, 0), root)

    # brazo izquierdo (se refleja despues)
    sh = box("arm_upper_L", (0.125, 0.15, 0.30), (0.305, -0.01, 0.95), "teal",
             rot=(0, math.radians(-7), 0), parent=arms)
    fo = box("arm_fore_L", (0.105, 0.13, 0.24), (0.335, -0.02, 0.69), "teal_d",
             rot=(0, math.radians(-5), 0), parent=arms)
    cuff = box("cuff_L", (0.115, 0.14, 0.05), (0.348, -0.02, 0.575), "white", parent=arms)

    # mano tipo manopla amarilla con 3 dedos
    palm = box("hand_L", (0.135, 0.13, 0.145), (0.352, -0.025, 0.487), "yellow", parent=arms)
    fingers = []
    for i, dx in enumerate((-0.040, 0.0, 0.040)):
        fingers.append(box(f"finger_L{i}", (0.034, 0.045, 0.070),
                           (0.352 + dx, -0.072, 0.432), "yellow", parent=arms))
    thumb = box("thumb_L", (0.048, 0.055, 0.048), (0.296, -0.05, 0.512), "yellow",
                rot=(0, 0, math.radians(18)), parent=arms)

    for ob in [sh, fo, cuff, palm, thumb] + fingers:
        mirror_x(ob, parent=arms)

    return arms


# ============================================================== PIERNAS =====

def build_legs(root):
    legs = empty("LEGS", (0, 0, 0), root)

    thigh = box("leg_upper_L", (0.19, 0.20, 0.20), (0.118, 0.0, 0.34), "teal_d", parent=legs)
    shin = box("leg_lower_L", (0.175, 0.19, 0.15), (0.118, 0.0, 0.175), "lime_d", parent=legs)
    shoe = box("shoe_L", (0.21, 0.30, 0.13), (0.118, -0.055, 0.065), "green_sh",
               rot=(0, 0, math.radians(7)), parent=legs)
    sole = box("sole_L", (0.22, 0.31, 0.035), (0.118, -0.055, 0.018), "navy",
               rot=(0, 0, math.radians(7)), parent=legs)
    tip = box("shoe_tip_L", (0.19, 0.08, 0.085), (0.128, -0.20, 0.082), "lime",
              rot=(0, 0, math.radians(7)), parent=legs)

    for ob in (thigh, shin, shoe, sole, tip):
        mirror_x(ob, parent=legs)

    return legs


# ================================================= camara, luces, render ====

def setup_lighting():
    def light(name, kind, loc, energy, rot=(0, 0, 0), size=5.0, color=(1, 1, 1)):
        d = bpy.data.lights.new(name, kind)
        d.energy = energy
        d.color = color
        if kind == "AREA":
            d.size = size
        ob = bpy.data.objects.new(name, d)
        ob.location = loc
        ob.rotation_euler = rot
        bpy.context.collection.objects.link(ob)
        return ob

    light("KeyLight", "AREA", (3.0, -3.5, 4.0), 320,
          rot=(math.radians(40), 0, math.radians(40)), size=6)
    light("FillLight", "AREA", (-3.5, -2.0, 2.0), 130,
          rot=(math.radians(65), 0, math.radians(-55)), size=6, color=(0.85, 0.9, 1.0))
    light("RimLight", "AREA", (0.0, 4.0, 3.0), 120,
          rot=(math.radians(125), 0, 0), size=5)


def setup_camera():
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 70
    cam = bpy.data.objects.new("Camera", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


def aim(cam, loc, target=(0, 0, 1.05)):
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def render_to(cam, loc, path, res=(900, 1100)):
    aim(cam, loc)
    scn = bpy.context.scene
    scn.render.resolution_x, scn.render.resolution_y = res
    scn.render.resolution_percentage = 100
    scn.render.image_settings.file_format = "PNG"
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print(f"[render] {path}")


# ================================================================== main ====

def main():
    reset_scene()

    root = empty("QUBI_RIG_ROOT", (0, 0, 0))
    build_legs(root)
    body = build_body(root)
    arms = build_arms(root)
    build_head(root)
    # Torso, brazos y cabeza bajan en bloque para asentarse sobre las
    # piernas acortadas (la cabeza ya lleva su propio offset interno).
    body.location.z -= 0.09
    arms.location.z -= 0.09
    add_outlines(thickness=0.019)

    setup_lighting()
    cam = setup_camera()

    blend_path = os.path.join(HERE, "robot.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[save] {blend_path}")

    bpy.ops.export_scene.gltf(
        filepath=os.path.join(HERE, "robot.glb"),
        export_format="GLB", use_selection=False, export_apply=True,
    )
    bpy.ops.export_scene.fbx(
        filepath=os.path.join(HERE, "robot.fbx"),
        use_selection=False, mesh_smooth_type="FACE",
    )

    render_to(cam, (0.0, -5.2, 1.15), os.path.join(HERE, "preview_front.png"))
    render_to(cam, (3.4, -4.0, 2.10), os.path.join(HERE, "preview_34.png"))
    render_to(cam, (5.2, 0.0, 1.15), os.path.join(HERE, "preview_side.png"))

    n = len([o for o in bpy.data.objects if o.type == "MESH"])
    tris = sum(len(o.data.loop_triangles) for o in bpy.data.objects if o.type == "MESH")
    print(f"[stats] objetos mesh: {n}")


if __name__ == "__main__":
    main()

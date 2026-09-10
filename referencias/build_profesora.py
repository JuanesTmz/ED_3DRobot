"""
Modelado low-poly del personaje "Profesora" (concept art Proyecto S&T).

Mismo lenguaje grafico que Qubi/K-7 (build_character.py): volumenes de caja y
cilindro de pocas caras, materiales planos con una pizca de emision propia y
contorno por cascara invertida. Cambia la anatomia: aqui hay proporciones
humanas (unas 7 cabezas) en lugar del ensamblaje de bloques del robot.

Uso:
    blender --background --python build_profesora.py

Genera:
    profesora.blend
    docs/profesora.glb
    preview_prof_front.png / preview_prof_34.png / preview_prof_side.png
"""

import bpy
import math
import os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))

# ---------------------------------------------------------------- paleta ----
# Muestreada del concept art (las dos laminas de WhatsApp).
PALETTE = {
    "khaki":     (0.784, 0.706, 0.514),   # salacot
    "khaki_d":   (0.639, 0.561, 0.384),   # ala / sombra del salacot
    "navy":      (0.161, 0.239, 0.365),   # polo
    "navy_d":    (0.110, 0.169, 0.271),   # mangas y sombra del polo
    "yellow":    (0.980, 0.780, 0.157),   # cuello del polo
    "skin":      (0.635, 0.400, 0.298),
    "skin_d":    (0.518, 0.310, 0.227),
    "hair":      (0.106, 0.114, 0.161),   # pelo rizado
    "denim":     (0.514, 0.573, 0.678),   # vaqueros
    "denim_d":   (0.404, 0.463, 0.573),
    "belt":      (0.494, 0.353, 0.220),   # cinturon de cuero
    "rope":      (0.706, 0.573, 0.400),   # soga
    "rope_d":    (0.588, 0.463, 0.310),
    "paper":     (0.929, 0.882, 0.729),   # hojas de la libreta
    "board":     (0.851, 0.792, 0.639),   # tapa de la libreta
    "metal":     (0.706, 0.729, 0.769),   # espiral, mosquetones, hebilla
    "bronze":    (0.639, 0.494, 0.239),   # medallon
    "white":     (0.960, 0.965, 0.975),
    "green":     (0.157, 0.451, 0.286),   # detalle de las zapatillas
    "ink":       (0.129, 0.145, 0.212),   # contornos, pupilas, montura
    "lens":      (0.741, 0.792, 0.910),
    "pink":      (0.902, 0.588, 0.604),   # goma del lapiz
    "pencil":    (0.949, 0.749, 0.208),
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
    if name == "metal":
        bsdf.inputs["Metallic"].default_value = 0.6
        bsdf.inputs["Roughness"].default_value = 0.35
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
    ink = PALETTE["ink"]
    bsdf.inputs["Base Color"].default_value = (0, 0, 0, 1)
    bsdf.inputs["Emission Color"].default_value = (*ink, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 1.0
    m.use_backface_culling = True   # clave: solo se ve la silueta
    m.diffuse_color = (*ink, 1.0)
    OUTLINE_MAT = m
    return m


# Piezas demasiado finas o demasiado internas para llevar contorno: la cascara
# invertida se las comeria enteras.
NO_OUTLINE = ("lens_", "gleam_", "brow_", "mouth_", "teeth", "stitch_",
              "iris_", "medallion_in")


def add_outlines(thickness=0.019):
    """Contorno estilo ilustracion: cascara invertida sobre cada malla."""
    for ob in bpy.data.objects:
        if ob.type != "MESH" or ob.name.startswith(NO_OUTLINE):
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


def cyl(name, radius, depth, loc, color, verts=12, rot=(0, 0, 0), scale=None,
        parent=None):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot
    )
    ob = bpy.context.object
    ob.name = name
    if scale:
        ob.scale = Vector(scale)
    ob.data.materials.append(mat(color))
    _finish(ob, parent)
    return ob


def ring(name, radius, thickness, depth, loc, color, verts=14, rot=(0, 0, 0),
         parent=None):
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


def sphere(name, radius, loc, color, scale=None, segments=10, rings=7,
           parent=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings,
                                         radius=radius, location=loc)
    ob = bpy.context.object
    ob.name = name
    if scale:
        ob.scale = Vector(scale)
    ob.data.materials.append(mat(color))
    _finish(ob, parent)
    return ob


def torus(name, major, minor, loc, color, rot=(0, 0, 0), mseg=14, nseg=6,
          scale=None, parent=None):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=mseg,
        minor_segments=nseg, location=loc, rotation=rot,
    )
    ob = bpy.context.object
    ob.name = name
    if scale:
        ob.scale = Vector(scale)
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
    dup.rotation_euler = (ob.rotation_euler[0], -ob.rotation_euler[1],
                          -ob.rotation_euler[2])
    if parent:
        dup.parent = parent
    return dup


# ============================================================== PIERNAS =====
# Altura total ~2.35 con el salacot puesto: la profesora saca poco mas de una
# cabeza a K-7 (2.13), que es la relacion que se lee en el concept.

def build_legs(root):
    legs = empty("LEGS", (0, 0, 0), root)
    x = 0.135

    # zapatilla azul marino con puntera y suela blancas
    shoe = box("shoe_L", (0.185, 0.40, 0.125), (x, -0.055, 0.077), "navy_d",
               parent=legs)
    sole = box("sole_L", (0.195, 0.41, 0.035), (x, -0.055, 0.018), "white",
               parent=legs)
    toe = box("shoe_tip_L", (0.175, 0.10, 0.075), (x, -0.215, 0.055), "white",
              parent=legs)
    band = box("shoe_band_L", (0.19, 0.055, 0.05), (x, 0.055, 0.052), "green",
               parent=legs)
    lace = box("shoe_lace_L", (0.085, 0.13, 0.03), (x, -0.115, 0.135), "white",
               parent=legs)

    # vaqueros: pernera recta, algo mas ancha en el muslo
    shin = box("leg_lower_L", (0.175, 0.205, 0.49), (x, -0.01, 0.375), "denim",
               parent=legs)
    knee = box("knee_L", (0.185, 0.215, 0.07), (x, -0.012, 0.615), "denim_d",
               parent=legs)
    thigh = box("leg_upper_L", (0.215, 0.245, 0.40), (x, -0.005, 0.83), "denim",
                parent=legs)

    for ob in (shoe, sole, toe, band, lace, shin, knee, thigh):
        mirror_x(ob, parent=legs)
    return legs


# =============================================================== CADERA =====

def build_hips(root):
    hips = empty("HIPS", (0, 0, 0), root)

    box("hips", (0.44, 0.30, 0.24), (0.0, 0.0, 1.10), "denim", parent=hips)
    # bragueta y bolsillos: solo insinuados, sin contorno propio
    box("stitch_fly", (0.022, 0.02, 0.15), (0.0, -0.155, 1.06), "denim_d",
        parent=hips)
    pocket = box("stitch_pocket_L", (0.10, 0.02, 0.10), (0.15, 0.155, 1.09),
                 "denim_d", parent=hips)
    mirror_x(pocket, parent=hips)

    # cinturon de cuero + hebilla
    box("belt", (0.455, 0.315, 0.075), (0.0, 0.0, 1.195), "belt", parent=hips)
    box("buckle", (0.085, 0.03, 0.075), (0.0, -0.165, 1.195), "metal",
        parent=hips)
    loop = box("belt_loop_L", (0.03, 0.33, 0.10), (0.155, 0.0, 1.19), "belt",
               parent=hips)
    mirror_x(loop, parent=hips)

    build_rope(hips)
    return hips


def build_rope(hips):
    """Rollo de soga colgado de la cadera, con dos cabos y sus ganchos."""
    x, y, z = 0.272, -0.045, 0.985
    # el disco de canto al eje X: es como se lee el rollo en el 3/4, que es
    # la vista donde el accesorio tiene que cantar.
    rot = (0, math.radians(90), 0)

    for i, (r, rr, dz) in enumerate(((0.115, 0.020, 0.0),
                                     (0.090, 0.018, -0.018),
                                     (0.068, 0.016, 0.012))):
        torus(f"rope_coil_{i}", r, rr, (x + i * 0.012, y, z + dz), "rope",
              rot=rot, mseg=14, nseg=6, scale=(1.0, 1.0, 1.15), parent=hips)

    # cabos que caen del rollo y terminan en gancho
    for i, dx in enumerate((-0.025, 0.045)):
        cyl(f"rope_tail_{i}", 0.018, 0.15, (x + dx, y + 0.02, z - 0.155),
            "rope_d", verts=8, parent=hips)
        cyl(f"hook_shaft_{i}", 0.014, 0.09, (x + dx, y + 0.02, z - 0.265),
            "metal", verts=8, parent=hips)
        box(f"hook_tip_{i}", (0.026, 0.032, 0.065),
            (x + dx - 0.027, y + 0.02, z - 0.312), "metal",
            rot=(0, math.radians(-22), 0), parent=hips)


# =============================================================== TORSO ======

def build_torso(root):
    torso = empty("TORSO", (0, 0, 0), root)

    # polo azul marino: caja principal + tapa de hombros mas ancha
    box("shirt", (0.44, 0.32, 0.50), (0.0, 0.0, 1.455), "navy", parent=torso)
    box("shirt_yoke", (0.485, 0.32, 0.14), (0.0, 0.0, 1.66), "navy",
        parent=torso)
    # bajo del polo, un poco suelto sobre el cinturon
    box("shirt_hem", (0.455, 0.33, 0.09), (0.0, 0.0, 1.245), "navy_d",
        parent=torso)

    # mangas cortas: cubren el arranque del biceps
    sleeve = box("sleeve_L", (0.145, 0.30, 0.22), (0.258, -0.005, 1.60),
                 "navy_d", rot=(0, math.radians(-6), 0), parent=torso)
    mirror_x(sleeve, parent=torso)

    build_collar(torso)
    build_medallion(torso)
    return torso


def build_collar(torso):
    """Cuello amarillo de polo: banda trasera + dos solapas en V."""
    box("collar_back", (0.30, 0.10, 0.10), (0.0, 0.115, 1.735), "yellow",
        parent=torso)
    side = box("collar_side_L", (0.10, 0.16, 0.10), (0.115, 0.02, 1.735),
               "yellow", rot=(0, 0, math.radians(-18)), parent=torso)
    mirror_x(side, parent=torso)
    flap = box("collar_flap_L", (0.115, 0.045, 0.19), (0.078, -0.152, 1.670),
               "yellow", rot=(math.radians(6), math.radians(-14), 0),
               parent=torso)
    mirror_x(flap, parent=torso)
    # tapeta con dos botones
    box("placket", (0.075, 0.03, 0.19), (0.0, -0.163, 1.585), "yellow",
        parent=torso)
    for i, z in enumerate((1.630, 1.555)):
        cyl(f"button_{i}", 0.016, 0.014, (0.0, -0.180, z), "ink", verts=8,
            rot=(math.radians(90), 0, 0), parent=torso)


def build_medallion(torso):
    """Cordon trenzado con el medallon de bronce sobre el pecho."""
    # El medallon queda POR ENCIMA del borde de la libreta (z ~ 1.46) o no se
    # ve nada de el desde el frente.
    for sx, tag in ((1, "L"), (-1, "R")):
        box(f"cord_{tag}", (0.022, 0.022, 0.22), (sx * 0.072, -0.170, 1.635),
            "rope", rot=(0, sx * math.radians(10), 0), parent=torso)
    cyl("medallion", 0.058, 0.022, (0.0, -0.176, 1.525), "bronze", verts=12,
        rot=(math.radians(90), 0, 0), parent=torso)
    cyl("medallion_in", 0.036, 0.026, (0.0, -0.180, 1.525), "khaki_d",
        verts=12, rot=(math.radians(90), 0, 0), parent=torso)
    ring("medallion_loop", 0.024, 0.009, 0.016, (0.0, -0.174, 1.582), "bronze",
         verts=10, rot=(math.radians(90), 0, 0), parent=torso)


# =============================================================== BRAZOS =====

def build_arms(root):
    arms = empty("ARMS", (0, 0, 0), root)

    # brazo izquierdo (se refleja despues): cae del hombro y el antebrazo
    # gira hacia delante para sostener la libreta contra el pecho.
    up = box("arm_upper_L", (0.115, 0.14, 0.26), (0.288, -0.005, 1.425),
             "skin", rot=(0, math.radians(-6), 0), parent=arms)
    elbow = box("elbow_L", (0.115, 0.14, 0.075), (0.282, -0.005, 1.300),
                "skin_d", rot=(0, math.radians(-6), 0), parent=arms)
    # antebrazo casi horizontal: lleva la mano hasta el borde de la libreta
    fore = box("arm_fore_L", (0.105, 0.115, 0.28), (0.255, -0.115, 1.290),
               "skin", rot=(math.radians(-80), 0, 0), parent=arms)
    hand = box("hand_L", (0.100, 0.115, 0.115), (0.205, -0.300, 1.285), "skin",
               rot=(0, 0, math.radians(-10)), parent=arms)
    thumb = box("thumb_L", (0.038, 0.070, 0.042), (0.152, -0.312, 1.335),
                "skin_d", rot=(0, math.radians(14), 0), parent=arms)
    fingers = []
    for i, dz in enumerate((-0.035, 0.005, 0.045)):
        fingers.append(box(f"finger_L{i}", (0.090, 0.05, 0.030),
                           (0.190, -0.362, 1.285 + dz), "skin_d", parent=arms))

    for ob in [up, elbow, fore, hand, thumb] + fingers:
        mirror_x(ob, parent=arms)

    build_notepad(arms)
    build_pencil(arms)
    return arms


def build_notepad(arms):
    """Libreta de espiral sujeta con las dos manos delante del pecho."""
    tilt = (math.radians(-14), 0, 0)
    box("pad_board", (0.31, 0.028, 0.38), (0.0, -0.330, 1.270), "board",
        rot=tilt, parent=arms)
    box("pad_paper", (0.285, 0.030, 0.345), (0.0, -0.343, 1.265), "paper",
        rot=tilt, parent=arms)
    # espiral metalica: aros pequenos a lo largo del borde superior
    for i in range(7):
        x = -0.120 + i * 0.040
        ring(f"pad_spiral_{i}", 0.022, 0.008, 0.013, (x, -0.296, 1.455),
             "metal", verts=8, rot=(0, math.radians(90), 0), parent=arms)


def build_pencil(arms):
    """Lapiz amarillo asomando por la mano derecha."""
    x = -0.235
    cyl("pencil", 0.018, 0.20, (x, -0.372, 1.185), "pencil", verts=8,
        rot=(math.radians(-14), 0, 0), parent=arms)
    cyl("pencil_eraser", 0.019, 0.04, (x, -0.348, 1.285), "pink", verts=8,
        rot=(math.radians(-14), 0, 0), parent=arms)
    cyl("pencil_tip", 0.016, 0.05, (x, -0.397, 1.087), "khaki", verts=8,
        rot=(math.radians(-14), 0, 0), parent=arms)


# =============================================================== CABEZA =====

def build_head(root):
    head = empty("HEAD", (0, 0, 0), root)

    box("neck", (0.15, 0.17, 0.12), (0.0, 0.005, 1.79), "skin_d", parent=head)
    # craneo: caja con las esquinas rebajadas para que no cante a robot
    skull = box("head_skull", (0.335, 0.325, 0.355), (0.0, 0.005, 2.03),
                "skin", parent=head)
    bevel_object(skull, width=0.055)
    box("jaw", (0.255, 0.275, 0.10), (0.0, -0.015, 1.878), "skin", parent=head)
    ear = box("ear_L", (0.045, 0.07, 0.095), (0.172, 0.03, 2.015), "skin_d",
              parent=head)
    mirror_x(ear, parent=head)
    earring = cyl("earring_L", 0.022, 0.012, (0.178, 0.035, 1.955), "bronze",
                  verts=8, rot=(0, math.radians(90), 0), parent=head)
    mirror_x(earring, parent=head)
    box("nose", (0.055, 0.055, 0.075), (0.0, -0.185, 1.985), "skin_d",
        parent=head)

    build_face(head)
    build_hair(head)
    build_hat(head)
    return head


def bevel_object(ob, width, segments=1):
    """Bevel horneado: quita el aire de caja sin disparar el conteo de caras."""
    bpy.context.view_layer.objects.active = ob
    m = ob.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    bpy.ops.object.modifier_apply(modifier="bevel")
    for p in ob.data.polygons:
        p.use_smooth = False


def build_face(head):
    """Gafas redondas, ojos grandes y sonrisa: los rasgos del concept."""
    eye_x, eye_z = 0.086, 2.050
    y_rim, y_lens, y_eye, y_pupil = -0.172, -0.166, -0.162, -0.158
    r_rim = 0.078
    rot_x = (math.radians(90), 0, 0)

    for sx, tag in ((1, "L"), (-1, "R")):
        x = sx * eye_x
        ring(f"rim_{tag}", r_rim, 0.016, 0.030, (x, y_rim, eye_z), "ink",
             verts=14, rot=rot_x, parent=head)
        cyl(f"lens_{tag}", r_rim - 0.016, 0.010, (x, y_lens, eye_z), "lens",
            verts=14, rot=rot_x, parent=head)
        cyl(f"eye_{tag}", 0.036, 0.012, (x, y_eye, eye_z), "white", verts=12,
            rot=rot_x, parent=head)
        cyl(f"iris_{tag}", 0.023, 0.010, (x, y_pupil, eye_z), "ink", verts=10,
            rot=rot_x, parent=head)
        cyl(f"gleam_{tag}", 0.011, 0.008,
            (x - sx * 0.010, y_pupil - 0.004, eye_z + 0.012), "white",
            verts=8, rot=rot_x, parent=head)
        # ceja gruesa por encima de la montura
        box(f"brow_{tag}", (0.090, 0.02, 0.020),
            (x, y_rim - 0.004, eye_z + 0.095), "hair",
            rot=(0, sx * math.radians(-7), 0), parent=head)
        # patilla de las gafas
        box(f"temple_{tag}", (0.018, 0.20, 0.016), (sx * 0.160, -0.070, eye_z),
            "ink", parent=head)

    box("bridge", (0.055, 0.018, 0.016), (0.0, y_rim, eye_z + 0.008), "ink",
        parent=head)

    build_mouth(head)


def build_mouth(head):
    """Sonrisa low-poly: segmentos siguiendo una parabola abierta hacia arriba."""
    y = -0.186
    z0, k, half = 1.912, 2.6, 0.062
    n = 5
    # dientes por detras de la linea de la boca
    box("teeth", (0.110, 0.025, 0.036), (0.0, y + 0.012, 1.938), "white",
        parent=head)
    for i in range(n):
        t = -half + (2 * half) * i / (n - 1)
        z = z0 + k * t * t
        slope = 2 * k * t                      # dz/dx -> giro tangente
        seg = 2 * half / (n - 1) * 1.4
        box(f"mouth_{i}", (seg, 0.03, 0.024), (t, y, z), "ink",
            rot=(0, -math.atan(slope), 0), parent=head)


def build_hair(head):
    """Melena rizada: racimo de esferas facetadas alrededor y por detras."""
    sphere("hair_back", 0.195, (0.0, 0.115, 2.005), "hair",
           scale=(1.05, 0.92, 1.0), parent=head)
    curls = [
        (0.185, 0.035, 1.985, 0.115),
        (0.205, 0.115, 2.045, 0.110),
        (0.170, 0.185, 1.960, 0.110),
        (0.100, 0.205, 2.050, 0.105),
        (0.185, 0.095, 1.865, 0.105),
        (0.125, 0.185, 1.855, 0.100),
        (0.050, 0.200, 1.870, 0.095),
        (0.215, 0.045, 2.080, 0.095),
    ]
    for i, (x, y, z, r) in enumerate(curls):
        c = sphere(f"hair_curl_L{i}", r, (x, y, z), "hair",
                   scale=(1.0, 1.0, 0.92), parent=head)
        mirror_x(c, parent=head)
    # flequillo que asoma bajo el ala del salacot
    sphere("hair_fringe", 0.16, (0.0, -0.09, 2.135), "hair",
           scale=(1.15, 0.85, 0.55), parent=head)


def build_hat(head):
    """Salacot: copa achatada, ala ancha, cinta y remate superior."""
    z = 2.215
    sphere("hat_dome", 0.235, (0.0, 0.01, z), "khaki",
           scale=(1.0, 1.0, 0.72), segments=14, rings=8, parent=head)
    cyl("hat_brim", 0.355, 0.045, (0.0, 0.01, z - 0.055), "khaki", verts=18,
        scale=(1.0, 1.05, 1.0), parent=head)
    cyl("hat_brim_edge", 0.365, 0.028, (0.0, 0.01, z - 0.072), "khaki_d",
        verts=18, scale=(1.0, 1.05, 1.0), parent=head)
    cyl("hat_band", 0.238, 0.055, (0.0, 0.01, z - 0.015), "khaki_d", verts=16,
        parent=head)
    cyl("hat_knob", 0.042, 0.05, (0.0, 0.01, z + 0.165), "khaki_d", verts=8,
        parent=head)
    # ojales de ventilacion
    for i, (x, y) in enumerate(((-0.115, -0.115), (0.115, -0.115),
                                (0.0, -0.175))):
        cyl(f"hat_vent_{i}", 0.017, 0.03, (x, y, z + 0.115), "khaki_d",
            verts=6, parent=head)


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
          rot=(math.radians(65), 0, math.radians(-55)), size=6,
          color=(0.85, 0.9, 1.0))
    light("RimLight", "AREA", (0.0, 4.0, 3.0), 120,
          rot=(math.radians(125), 0, 0), size=5)


def setup_camera():
    cam_data = bpy.data.cameras.new("Camera")
    cam_data.lens = 70
    cam = bpy.data.objects.new("Camera", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    return cam


def aim(cam, loc, target=(0, 0, 1.15)):
    cam.location = loc
    d = Vector(target) - Vector(loc)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def render_to(cam, loc, path, res=(900, 1150)):
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

    root = empty("PROFESORA_RIG_ROOT", (0, 0, 0))
    build_legs(root)
    build_hips(root)
    build_torso(root)
    build_arms(root)
    build_head(root)
    add_outlines(thickness=0.019)

    setup_lighting()
    cam = setup_camera()

    blend_path = os.path.join(HERE, "profesora.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)
    print(f"[save] {blend_path}")

    os.makedirs(os.path.join(HERE, "docs"), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(HERE, "docs", "profesora.glb"),
        export_format="GLB", use_selection=False, export_apply=True,
    )

    render_to(cam, (0.0, -5.4, 1.25),
              os.path.join(HERE, "preview_prof_front.png"))
    render_to(cam, (3.5, -4.2, 2.20),
              os.path.join(HERE, "preview_prof_34.png"))
    render_to(cam, (5.4, 0.0, 1.25),
              os.path.join(HERE, "preview_prof_side.png"))

    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    for o in meshes:
        o.data.calc_loop_triangles()
    tris = sum(len(o.data.loop_triangles) for o in meshes)
    print(f"[stats] objetos mesh: {len(meshes)}  triangulos: {tris}")


if __name__ == "__main__":
    main()

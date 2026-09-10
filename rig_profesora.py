"""
Riggea a la Profesora y exporta docs/character/profesora.glb.

Fuente: referencias/Profe_live.blend (copia de la escena que el autor tiene
abierta en Blender). Ese archivo no trae armature: modela el cuerpo entero 5
veces, una por pose, repartido en 5 colecciones por parte del cuerpo
(Piernas.00N / Torso.00N / Brazos.00N / Cabeza.00N / Objetos.00N). Las poses,
verificadas renderizando cada bucket por separado, son:

    .001 -> reposo       (de pie, libreta contra el pecho)   <- pose de bind
    .002 -> escribiendo  (girada, escribiendo en la libreta)
    .003 -> eureka       (lapiz en alto en la mano derecha)
    .004 -> mirando      (de pie relajada, libreta bajo el brazo)
    .005 -> caminando    (zancada)

Tres cosas que este pipeline tiene que hacer bien, y que son la razon de que
sea mas largo que un simple "unir y exportar":

1. NORMALES. 65 de las 200 piezas son espejos hechos con escala X NEGATIVA
   (todo el lado _R, mas shoe_l). Al unir las mallas, Blender hornea esa
   escala y el winding de esas piezas queda invertido: la malla base se
   ilumina al reves y el casco invertido del contorno, en vez de quedar
   oculto por el backface culling, se dibuja SOLIDO encima. Eso es lo que se
   veia como "medio cuerpo negro". Se arregla aplicando rotacion+escala y
   recalculando normales hacia fuera ANTES de hornear nada -el mismo paso que
   rig_and_export.py ya hacia para K-7.

2. CONTORNO. El solidify que traen las piezas usa grosor 0.0679 en espacio
   LOCAL, sin compensar la escala del objeto: en piezas alargadas (y sobre
   todo en el pelo, que son decenas de esferas pequenas) el contorno se
   infla hasta comerse la pieza. Se rehace con grosor uniforme en mundo,
   como K-7. Ademas el shell se manda al ULTIMO slot de material (que se
   fuerza a ser el outline) en vez de usar material_offset relativo, que en
   piezas con 3-4 slots mandaba el shell a un material cualquiera.

3. POSES FIELES. El retarget no aproxima: a cada hueso se le da la
   transformada COMPLETA de su pieza (rotacion Y traslacion), descontando el
   desplazamiento lateral del diorama. Como el skinning es rigido (peso 1.0),
   eso reproduce la pose exactamente como esta modelada. Los accesorios que
   el autor mueve por su cuenta -libreta, lapiz, soga- llevan hueso propio,
   porque no siguen a ninguna mano de forma consistente entre poses.

Uso:
    blender -b -P rig_profesora.py

Salida:
    docs/character/profesora.glb
    referencias/profesora_rigged.blend   (para retocar a mano)
    preview_profesora_*.png              (una por pose, para revisar)
"""

import bpy
import bmesh
import colorsys
import os
import math
from mathutils import Matrix, Vector, Quaternion

HERE = os.path.dirname(os.path.abspath(__file__))
SRC_BLEND = os.path.join(HERE, "referencias", "Profe_live.blend")
FALLBACK_BLEND = os.path.join(HERE, "referencias", "Profe.blend")
OUT_GLB = os.path.join(HERE, "docs", "character", "profesora.glb")
OUT_BLEND = os.path.join(HERE, "referencias", "profesora_rigged.blend")

GROSOR_CONTORNO = 0.019      # en unidades de mundo, igual que K-7
EMISION_PLANA = 0.2          # cuanto del propio color emite cada material
TINTA_BOCA = (0.153, 0.204, 0.278)   # rol 'oscuro' de la paleta 1: el color
                                     # con que build_bocas.py pinta bocas.glb
BLANCO_K7 = (0.960, 0.965, 0.975)    # rol 'claro' de la paleta 1

# Los discos de la cara de Vero, al material de K-7 que les corresponde. Los
# nombres son exactos a proposito: son los que paleta.js mapea a un rol, y de
# eso depende que su cara cambie de color con la paleta igual que la de K-7.
OJOS_COMO_K7 = {
    "Ojo.L": "M_navy", "Ojo.R": "M_navy",                   # el iris
    "PupilaGrande.R": "M_white", "PupilaPequeña.R": "M_white",   # los brillos
    "PupulaGrande.L": "M_white", "pupilaPequeña.L": "M_white",
}

# Colores que Vero le toma prestados a la paleta 1 de K-7 (ver
# docs/character/paleta.js), para que los dos se lean del mismo mundo sin
# quitarle a ella su ropa sobria: solo los acentos, el calzado y sus detalles.
# El pantalon, el salacot, la piel y el pelo se quedan como estan.
#
# Valores en RGB LINEAL, igual que paleta.js: son los mismos numeros.
AZUL_K7 = (0.243, 0.463, 0.612)       # 'bata_d': el azul medio del personaje
TEAL_K7 = (0.353, 0.596, 0.741)       # 'bata'
COLORES_DE_K7 = {
    "M_yellow": (0.965, 0.749, 0.110),        # cuello del polo -> 'amarillo'
    "M_navy": AZUL_K7,                        # camisa
    "Material.009": (0.170, 0.324, 0.428),    # sombra de la camisa: el mismo
                                              # azul al 70%, para conservar la
                                              # relacion claro/oscuro que traia
    "M_navy_d.004": (0.170, 0.324, 0.428),    # mangas, idem
    "M_navy_d.005": TEAL_K7,                  # zapato derecho
    "M_navy_d.006": TEAL_K7,                  # zapato izquierdo
    "Material.012": (0.588, 0.769, 0.180),    # franja del zapato -> 'acento'
    "Material.014": (0.588, 0.769, 0.180),
}

# Saturacion OBJETIVO de cada material (en sRGB, 0..1), por prefijo de nombre.
# Es un destino, no un factor: multiplicar no servia porque su ropa parte de
# saturaciones bajisimas -el pantalon esta en 0.12- y por mucho que se
# multiplique sigue siendo un gris. Al lado de K-7, que vive entre 0.28 (su
# teal) y 0.63 (su amarillo), se leia apagada.
#
# Nunca BAJA la saturacion de un color, solo la sube hasta el objetivo.
#
# Lo que NO esta aqui se queda como esta, y a proposito: los colores que ya
# vienen de la paleta de K-7 (camisa, zapatos, cuello, franja; ver
# COLORES_DE_K7) tienen que seguir coincidiendo con los suyos, y los ojos y la
# boca ('M_navy'/'M_white' exactos) los pinta paleta.js en tiempo de ejecucion.
SATURACION_OBJETIVO = {
    "M_denim": 0.40,      # el pantalon, lo mas apagado que llevaba
    "M_khaki": 0.42,      # el salacot
    "M_rope": 0.50, "M_rope_d": 0.50,
    "M_hair": 0.45,       # el pelo azul-negro gana caracter
    "M_board": 0.30,      # la libreta es papel: no tiene que gritar
    "M_metal": 0.22,      # espiral y mosquetones
    "M_pencil": 0.70,     # el lapiz amarillo, que cante
    "M_ink": 0.40,
    "M_skin": 0.40, "M_skin_d": 0.40,   # la piel, calida pero sin pasarse
}
# nombres EXACTOS que nunca se tocan aunque casen con un prefijo de arriba
SIN_SATURAR = {"M_navy", "M_white"}

BUCKETS = {
    "reposo": ".001",
    "escribiendo": ".002",
    "eureka": ".003",
    "mirando": ".004",
    "caminando": ".005",
}
BIND = "reposo"
PART_COLLECTIONS = ("Piernas", "Torso", "Brazos", "Cabeza", "Objetos")

# pieza (nombre base, sin el .NNN de pose) -> hueso que la carga rigidamente
BONE_OF_PIECE = {
    "head_skull": "head", "hair": "head", "sombrero": "head", "rim_L": "head",
    "Ojo.L": "head", "Ojo.R": "head",
    "PupilaGrande.R": "head", "PupilaPequeña.R": "head",
    "PupulaGrande.L": "head", "pupilaPequeña.L": "head",

    "shirt": "chest", "collar_flap_L": "chest", "collar_side_R": "chest",

    "arm_upper_L": "upperarm_L", "arm_upper_R": "upperarm_R",
    "sleeve_L": "upperarm_L", "sleeve_R": "upperarm_R",
    "arm_fore_L": "forearm_L", "arm_fore_R": "forearm_R",
    "hand_L": "hand_L", "hand_R": "hand_R",
    "thumb_L": "hand_L", "thumb_R": "hand_R",
    "finger_L0": "hand_L", "finger_L1": "hand_L", "finger_L2": "hand_L",
    "finger_R0": "hand_R", "finger_R1": "hand_R", "finger_R2": "hand_R",

    "hips": "hips",
    "leg_upper_L": "thigh_L", "leg_upper_R": "thigh_R",
    "leg_lower_L": "shin_L", "leg_lower_R": "shin_R",
    # OJO: los zapatos estan cruzados respecto a su nombre. En el .blend
    # 'shoe_R' esta en x=+0.135 (la IZQUIERDA del personaje) y 'shoe_l' en
    # x=-0.135 (la derecha). Mapearlos por el nombre ponia el hueso del pie
    # cruzando el cuerpo hasta el zapato del otro lado, y de ahi las
    # trayectorias imposibles al caminar. Va por posicion, no por nombre;
    # comprobar_lados() avisa si esto cambia.
    "shoe_R": "foot_L", "shoe_l": "foot_R",

    # Accesorios. Van pegados a su mano y se mueven con ella: medido sobre las
    # 5 poses, el lapiz se queda a 2-6 cm de hand_L y la libreta a 14-25 cm de
    # hand_R, asi que el agarre es consistente. Darles hueso propio los hacia
    # interpolar por su cuenta entre fotogramas y se despegaban de la mano.
    "pencil": "hand_L",
    "pad_board": "hand_R", "pad_spiral_0": "hand_R",
    "rope_coil_0": "hips",          # la soga cuelga de la cadera
}

# Piezas que nunca llevan hueso propio aunque se desvien: son las que tienen
# que seguir a su hueso si o si (ver BONE_OF_PIECE).
PEGADAS = {"pencil", "pad_board", "pad_spiral_0", "rope_coil_0"}

# Huesos que solo giran, nunca se trasladan por su cuenta. Las piernas van
# aqui para que los pies describan el arco de la pierna en vez de saltar de
# una posicion a otra al interpolar.
SOLO_GIRO = {"thigh_L", "shin_L", "foot_L", "thigh_R", "shin_R", "foot_R"}

# hueso -> pieza cuya transformada se le copia al retarget-ear
PIECE_OF_BONE = {
    "hips": "hips", "chest": "shirt", "head": "head_skull",
    "upperarm_L": "arm_upper_L", "forearm_L": "arm_fore_L", "hand_L": "hand_L",
    "upperarm_R": "arm_upper_R", "forearm_R": "arm_fore_R", "hand_R": "hand_R",
    "thigh_L": "leg_upper_L", "shin_L": "leg_lower_L", "foot_L": "shoe_R",
    "thigh_R": "leg_upper_R", "shin_R": "leg_lower_R", "foot_R": "shoe_l",
}

# (hueso, padre). Las posiciones se calculan de la geometria real, ver
# esqueleto_de_geometria(). El orden es padre-antes-que-hijo a proposito:
# lo usan tanto el armado como el retarget.
JERARQUIA = [
    ("root", None), ("hips", "root"), ("spine", "hips"), ("chest", "spine"),
    ("head", "chest"),
    ("upperarm_L", "chest"), ("forearm_L", "upperarm_L"), ("hand_L", "forearm_L"),
    ("upperarm_R", "chest"), ("forearm_R", "upperarm_R"), ("hand_R", "forearm_R"),
    ("thigh_L", "hips"), ("shin_L", "thigh_L"), ("foot_L", "shin_L"),
    ("thigh_R", "hips"), ("shin_R", "thigh_R"), ("foot_R", "shin_R"),
]
BONE_NAMES = [b for b, _ in JERARQUIA]
PARENT_OF = dict(JERARQUIA)


# cuanto puede desviarse una pieza de su hueso (en unidades de mundo) antes
# de que se le de hueso propio. La profesora mide 2.4: 8 mm ya se nota.
TOLERANCIA_PIEZA = 0.008

# cuanto se le permite errar a un hueso que solo gira antes de dejarle
# trasladar tambien (ver matrices_objetivo)
TOLERANCIA_FK = 0.02

BALANCEO_BRAZOS = 9.0    # grados de vaiven de los brazos en la caminata
TRAZO_ESCRIBIR = 0.017   # cuanto recorre la mano del lapiz al escribir


def base_name(name):
    if len(name) > 4 and name[-4] == "." and name[-3:].isdigit():
        return name[:-4]
    return name


def seleccionar(objs, activo=None):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = activo or (objs[0] if objs else None)


# ============================================================ 1. recoleccion =

def recoger_piezas():
    """objs[pose][pieza] = objeto Blender (mientras todavia existen todas)."""
    objs = {}
    for pose, suf in BUCKETS.items():
        piezas = {}
        for part in PART_COLLECTIONS:
            col = bpy.data.collections.get(f"{part}{suf}")
            if not col:
                raise RuntimeError(f"falta la coleccion {part}{suf}")
            for o in col.objects:
                if o.type == "MESH":
                    piezas[base_name(o.name)] = o
        objs[pose] = piezas
    return objs


def fotografiar(objs):
    """Copia la transformada y la caja local de cada pieza ANTES de tocar nada.

    El retarget trabaja solo con estos numeros, asi que los pasos que vienen
    despues (aplicar escala, rehacer el contorno, unir) no lo afectan."""
    datos = {}
    for pose, piezas in objs.items():
        datos[pose] = {
            k: {"m": o.matrix_world.copy(),
                "bbox": [Vector(c) for c in o.bound_box],
                "verts": len(o.data.vertices)}
            for k, o in piezas.items()
        }
    return datos


# ================================================ 2. normales y transformadas =

def aplanar_transformadas(piezas):
    """Aplica rotacion+escala y deja todas las normales mirando hacia fuera.

    Las 65 piezas espejadas tienen escala X negativa; al hornearla el winding
    queda invertido y three.js las pinta al reves (y el casco del contorno se
    vuelve solido). Las formas son convexas y cerradas, asi que recalcular
    hacia fuera es seguro."""
    ms = list(piezas.values())
    seleccionar(ms)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

    seleccionar(ms)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    invertidas = [o.name for o in ms if o.matrix_world.to_3x3().determinant() < 0]
    if invertidas:
        print("  ! siguen con determinante negativo:", invertidas)


def material_contorno():
    m = bpy.data.materials.get("M_outline_profesora")
    if m:
        return m
    m = bpy.data.materials.new("M_outline_profesora")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    tinta = (0.129, 0.145, 0.212)
    b.inputs["Base Color"].default_value = (0, 0, 0, 1)
    b.inputs["Roughness"].default_value = 1.0
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Emission Color"].default_value = (*tinta, 1.0)
    b.inputs["Emission Strength"].default_value = 1.0
    m.use_backface_culling = True
    m.diffuse_color = (*tinta, 1.0)
    return m


def rehacer_contorno(piezas):
    """Contorno por cascara invertida, con grosor uniforme en mundo.

    El solidify original venia con grosor en espacio local sin compensar la
    escala del objeto: en el pelo (decenas de esferas de radio ~0.1) el
    contorno se comia la pieza entera. Ademas mandaba el shell a
    material_index+1, que en piezas de 3-4 slots caia en un material
    cualquiera -y esos no llevan backface culling, asi que tapaban la pieza.
    Aqui el outline se fuerza a ser el ULTIMO slot y el shell se manda ahi con
    un offset grande (Blender lo clampea al ultimo)."""
    contorno = material_contorno()
    for o in piezas.values():
        for mod in list(o.modifiers):
            o.modifiers.remove(mod)

        # fuera los slots de contorno viejos; el nuevo va al final
        for i in range(len(o.data.materials) - 1, -1, -1):
            m = o.data.materials[i]
            if m and "outline" in m.name.lower():
                o.data.materials.pop(index=i)
        o.data.materials.append(contorno)
        idx_contorno = len(o.data.materials) - 1

        # los indices de material de las caras se corren al quitar slots:
        # se reasignan clampeando al rango que queda de relleno
        for p in o.data.polygons:
            if p.material_index >= idx_contorno:
                p.material_index = 0

        mod = o.modifiers.new("contorno", "SOLIDIFY")
        mod.thickness = GROSOR_CONTORNO
        mod.offset = 1.0
        mod.use_flip_normals = True
        mod.use_rim = False
        mod.material_offset = 999          # clampea al ultimo slot = contorno
        mod.material_offset_rim = 999

        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier="contorno")


def igualar_emision(piezas):
    """Todos los materiales emiten un poco de su propio color.

    Los M_* del personaje ya venian con 0.2 y los Material.* (suelas,
    pupilas, detalles) con 0: bajo la luz del visor esos ultimos quedaban
    mucho mas apagados que el resto y rompian el acabado plano."""
    vistos = set()
    for o in piezas.values():
        for m in o.data.materials:
            if not m or m.name in vistos or not m.use_nodes:
                continue
            vistos.add(m.name)
            b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if not b or "outline" in m.name.lower():
                continue
            c = b.inputs["Base Color"].default_value
            b.inputs["Emission Color"].default_value = (c[0], c[1], c[2], 1.0)
            b.inputs["Emission Strength"].default_value = EMISION_PLANA
    return len(vistos)


def material_de_cara(nombre, color):
    """Material plano con un nombre EXACTO de los que paleta.js reconoce."""
    m = bpy.data.materials.get(nombre) or bpy.data.materials.new(nombre)
    if m.name != nombre:
        raise RuntimeError(f"el nombre '{nombre}' estaba ocupado: salio '{m.name}'")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = 0.92
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Emission Color"].default_value = (*color, 1.0)
    b.inputs["Emission Strength"].default_value = EMISION_PLANA
    m.diffuse_color = (*color, 1.0)
    return m


def tenir_ojos(piezas):
    """Le da a los ojos de Vero los mismos materiales que los de K-7.

    ojos.glb pinta el iris con 'M_navy' y el brillo con 'M_white', y bocas.glb
    la boca con 'M_navy'. No son nombres cualesquiera: paleta.js los reconoce
    como los roles 'oscuro' y 'claro', y por eso la cara de K-7 cambia de color
    con la paleta. Dandole a Vero esos MISMOS materiales, sus ojos y su boca
    acompanan a los de K-7 en las tres paletas, y no solo coinciden en la
    primera. Ademas se unifican: los seis discos venian cada uno con su
    material suelto (Material.002, .003, ...) del mismo color.

    Los ojos venian en negro absoluto, mas duros que todo lo demas; el color
    de arranque es el de la paleta 1, igual que el que trae bocas.glb."""
    navy = material_de_cara("M_navy", TINTA_BOCA)
    blanco = material_de_cara("M_white", BLANCO_K7)

    tocados = []
    for clave, mat in OJOS_COMO_K7.items():
        o = piezas.get(clave)
        if not o:
            print(f"  ! no esta la pieza de ojo '{clave}'")
            continue
        m = navy if mat == "M_navy" else blanco
        o.data.materials.clear()
        o.data.materials.append(m)
        for p in o.data.polygons:
            p.material_index = 0
        tocados.append(f"{clave}->{m.name}")
    return tocados


def _a_srgb(c):
    return 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055


def _a_lineal(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def saturar(color, objetivo):
    """Sube la saturacion hasta `objetivo`, dejando tono y brillo donde estaban.

    El ajuste va en sRGB, que es donde 'saturado' significa lo que uno espera.
    Los materiales guardan RGB LINEAL (igual que paleta.js), asi que hay que
    ir y volver: hacerlo directamente sobre el lineal aclara los colores en
    vez de avivarlos."""
    r, g, b = (_a_srgb(c) for c in color)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    r, g, b = colorsys.hsv_to_rgb(h, max(s, objetivo), v)
    return tuple(_a_lineal(c) for c in (r, g, b))


def saturar_ropa(piezas):
    """Aviva los colores propios de Vero (ver SATURACION_OBJETIVO)."""
    cambiados = []
    vistos = set()
    for o in piezas.values():
        for m in o.data.materials:
            if not m or m.name in vistos or not m.use_nodes:
                continue
            vistos.add(m.name)
            if m.name in SIN_SATURAR or "outline" in m.name.lower():
                continue
            objetivo = next((o for clave, o in SATURACION_OBJETIVO.items()
                             if m.name == clave or m.name.startswith(clave + ".")), None)
            if not objetivo:
                continue
            b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if not b:
                continue
            c = b.inputs["Base Color"].default_value
            nuevo = saturar((c[0], c[1], c[2]), objetivo)
            b.inputs["Base Color"].default_value = (*nuevo, 1.0)
            m.diffuse_color = (*nuevo, 1.0)
            cambiados.append(f"{m.name}->{objetivo}")
    return cambiados


def armonizar_con_k7(piezas):
    """Pasa los acentos de Vero a los colores de la paleta 1 de K-7.

    El nombre del material manda: los M_navy_d.00N son piezas distintas
    (mangas y cada zapato) aunque vengan del mismo color, y aqui van a sitios
    distintos, asi que la tabla los distingue por nombre completo."""
    cambiados = []
    vistos = set()
    for o in piezas.values():
        for m in o.data.materials:
            if not m or m.name in vistos or not m.use_nodes:
                continue
            vistos.add(m.name)
            color = next((c for clave, c in COLORES_DE_K7.items()
                          if m.name == clave or m.name.startswith(clave + ".")), None)
            if not color:
                continue
            b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if not b:
                continue
            b.inputs["Base Color"].default_value = (*color, 1.0)
            m.diffuse_color = (*color, 1.0)
            cambiados.append(m.name)
    return cambiados


def quitar_otras_poses(objs, conservar):
    for pose, piezas in objs.items():
        if pose == conservar:
            continue
        for o in piezas.values():
            if o.name in bpy.data.objects:
                bpy.data.objects.remove(o, do_unlink=True)
    for o in [o for o in bpy.data.objects if o.type in ("CAMERA", "LIGHT", "EMPTY")]:
        bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections):
        if not c.objects:
            bpy.data.collections.remove(c)
    for me in list(bpy.data.meshes):
        if me.users == 0:
            bpy.data.meshes.remove(me)


def enlazar_a_raiz(piezas):
    """Las colecciones de Profe.blend cuelgan de la view layer de un modo que
    --background desincroniza al borrar objetos en bloque (view_layer.objects
    se queda con una foto vieja). Enlazar las piezas que se conservan directo
    en la coleccion raiz las deja a salvo."""
    raiz = bpy.context.scene.collection
    for o in piezas.values():
        if o.name not in raiz.objects:
            raiz.objects.link(o)


# ================================================== 3. esqueleto y skinning ==

def extremos(dato):
    """Los dos extremos del eje largo de una pieza, en mundo."""
    m, bb = dato["m"], dato["bbox"]
    lo = Vector((min(c[i] for c in bb) for i in range(3)))
    hi = Vector((max(c[i] for c in bb) for i in range(3)))
    tam = [(hi[i] - lo[i]) * m.to_scale()[i] for i in range(3)]
    eje = max(range(3), key=lambda i: abs(tam[i]))
    a, b = lo.copy(), hi.copy()
    a[eje], b[eje] = lo[eje], hi[eje]
    for i in range(3):
        if i != eje:
            a[i] = b[i] = (lo[i] + hi[i]) / 2
    return m @ a, m @ b


def comprobar_lados(bind):
    """Avisa si una pieza acaba en un hueso del lado contrario.

    Los nombres del .blend no son de fiar para esto -los zapatos vienen
    cruzados- asi que lo que manda es donde esta la pieza: +X es la izquierda
    del personaje. Un hueso de miembro que apunte al lado contrario cruza el
    cuerpo y produce trayectorias imposibles al animar."""
    fallos = []
    for pieza, hueso in BONE_OF_PIECE.items():
        if pieza not in bind or not (hueso.endswith("_L") or hueso.endswith("_R")):
            continue
        d = bind[pieza]
        x = (sum((d["m"] @ Vector(c) for c in d["bbox"]), Vector()) / 8).x
        if abs(x) < 0.02:          # pieza centrada: no tiene lado
            continue
        esperado = "_L" if x > 0 else "_R"
        if not hueso.endswith(esperado):
            fallos.append((pieza, hueso, x))
    return fallos


def piezas_sueltas(datos):
    """Piezas que no siguen fielmente al hueso que les toca, en alguna pose.

    Un hueso se mueve copiando a su pieza guia (PIECE_OF_BONE). Una pieza P
    colgada de ese hueso acaba en

        pieza_guia_objetivo @ pieza_guia_rest^-1 @ P_rest

    que solo coincide con donde el autor puso P si las movio juntas. La manga
    o el cuello, por ejemplo, los recoloca aparte del brazo o del torso, y
    entonces quedan flotando. Las que se desvian se detectan aqui y se llevan
    su propio hueso, hijo del anatomico: asi cualquier pose se reproduce tal
    cual esta modelada, sin tener que ir adivinando pieza por pieza."""
    bind = datos[BIND]
    guia_de_hueso = PIECE_OF_BONE
    sueltas = {}
    for pieza, hueso in BONE_OF_PIECE.items():
        guia = guia_de_hueso.get(hueso)
        if not guia or guia == pieza or pieza not in bind or pieza in PEGADAS:
            continue
        peor = 0.0
        esquinas = [bind[pieza]["m"] @ Vector(c) for c in bind[pieza]["bbox"]]
        for pose in BUCKETS:
            if pose == BIND:
                continue
            obj = datos[pose]
            if guia not in obj or pieza not in obj:
                continue
            desfase = obj["hips"]["m"].translation - bind["hips"]["m"].translation
            T = Matrix.Translation(-desfase)
            arrastrada = T @ obj[guia]["m"] @ bind[guia]["m"].inverted()
            real = T @ obj[pieza]["m"] @ bind[pieza]["m"].inverted()
            for e in esquinas:
                peor = max(peor, (arrastrada @ e - real @ e).length)
        if peor > TOLERANCIA_PIEZA:
            sueltas[pieza] = (hueso, peor)
    return sueltas


def esqueleto_de_geometria(bind):
    """(hueso -> (cabeza, cola)) medido sobre las piezas de la pose de reposo.

    Para los miembros se usa el eje largo de la pieza y se toma como cabeza el
    extremo mas cercano al hueso padre: asi las articulaciones caen donde
    realmente se doblan y el esqueleto sirve para animar a mano."""
    def caja(p):
        d = bind[p]
        pts = [d["m"] @ Vector(c) for c in d["bbox"]]
        lo = Vector((min(q[i] for q in pts) for i in range(3)))
        hi = Vector((max(q[i] for q in pts) for i in range(3)))
        return lo, hi, (lo + hi) / 2

    hips_lo, hips_hi, hips_c = caja("hips")
    shirt_lo, shirt_hi, shirt_c = caja("shirt")
    head_lo, head_hi, head_c = caja("head_skull")
    hat_lo, hat_hi, _ = caja("sombrero")

    huesos = {}
    huesos["root"] = (Vector((0, 0, 0)), Vector((0, 0.15, 0)))
    huesos["hips"] = (Vector((0, 0, hips_lo.z)), Vector((0, 0, hips_hi.z)))
    huesos["spine"] = (Vector((0, 0, hips_hi.z)), Vector((0, 0, shirt_c.z)))
    huesos["chest"] = (Vector((0, 0, shirt_c.z)), Vector((0, 0, shirt_hi.z)))
    huesos["head"] = (Vector((0, 0, shirt_hi.z)), Vector((0, 0, hat_hi.z)))

    # las piezas salen de PIECE_OF_BONE, no de una segunda lista: repetirlas
    # aqui fue lo que dejo los huesos de los pies emparejados por nombre
    # -y cruzados- cuando se corrigio el mapeo de los zapatos
    cadenas = [
        ["upperarm_L", "forearm_L", "hand_L"],
        ["upperarm_R", "forearm_R", "hand_R"],
        ["thigh_L", "shin_L", "foot_L"],
        ["thigh_R", "shin_R", "foot_R"],
    ]
    for bones in cadenas:
        ancla = huesos[PARENT_OF[bones[0]]][0]   # cabeza del hueso padre
        for bone in bones:
            a, b = extremos(bind[PIECE_OF_BONE[bone]])
            if (a - ancla).length > (b - ancla).length:
                a, b = b, a
            huesos[bone] = (a, b)
            ancla = b

    # accesorios y piezas sueltas: el hueso es el eje largo de su propia pieza
    for bone in BONE_NAMES:
        if bone in huesos:
            continue
        huesos[bone] = extremos(bind[PIECE_OF_BONE[bone]])
    return huesos


def registrar_huesos_de_pieza(sueltas):
    """Da hueso propio a las piezas que no siguen a su hueso anatomico.

    El hueso nuevo cuelga del anatomico, asi que el esqueleto se sigue
    animando a mano igual (girar 'chest' arrastra cuello y mangas); lo que
    gana es que el retarget puede colocar esas piezas exactamente donde el
    autor las dejo."""
    for pieza, (anatomico, _) in sueltas.items():
        hueso = "p_" + pieza.replace(".", "_")
        JERARQUIA.append((hueso, anatomico))
        PARENT_OF[hueso] = anatomico
        BONE_NAMES.append(hueso)
        BONE_OF_PIECE[pieza] = hueso
        PIECE_OF_BONE[hueso] = pieza


def construir_armature(huesos):
    # bpy.ops.object.armature_add() resuelve la coleccion activa via
    # bpy.context.collection, que en --background es None: crea el objeto mal
    # y descoloca la view layer. Se crea con la API de datos.
    datos = bpy.data.armatures.new("Profesora_Skeleton")
    arm = bpy.data.objects.new("Profesora_Armature", datos)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)

    bpy.ops.object.mode_set(mode="EDIT")
    eb = datos.edit_bones
    for b in list(eb):
        eb.remove(b)
    for nombre, padre in JERARQUIA:
        cabeza, cola = huesos[nombre]
        if (cola - cabeza).length < 1e-4:      # hueso degenerado: dale largo
            cola = cabeza + Vector((0, 0, 0.05))
        b = eb.new(nombre)
        b.head, b.tail = cabeza, cola
        b.use_connect = False
        if padre:
            b.parent = eb[padre]
    bpy.ops.object.mode_set(mode="OBJECT")

    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"
    return arm


def asignar_pesos(piezas):
    cuenta = {}
    for clave, o in piezas.items():
        hueso = BONE_OF_PIECE.get(clave)
        if not hueso:
            raise RuntimeError(f"pieza sin hueso asignado: {clave}")
        vg = o.vertex_groups.new(name=hueso)
        vg.add(range(len(o.data.vertices)), 1.0, "REPLACE")
        cuenta[hueso] = cuenta.get(hueso, 0) + 1
    return cuenta


def unir_y_emparentar(piezas, arm):
    ms = list(piezas.values())
    cuerpo = piezas["shirt"]
    seleccionar(ms, activo=cuerpo)
    bpy.ops.object.join()
    malla = bpy.context.object
    malla.name = "Profesora"
    malla.data.name = "ProfesoraMesh"

    seleccionar([malla, arm], activo=arm)
    bpy.ops.object.parent_set(type="ARMATURE_NAME")
    return malla


# =================================================== 4. retarget de las poses =

def matrices_objetivo(rest_world, bind, objetivo, registro=None):
    """Matriz de mundo que le toca a cada hueso en esa pose.

    Skinning rigido (peso 1.0) => vertice_final = hueso_posado @ hueso_rest^-1
    @ vertice_rest. Para que la pieza caiga EXACTAMENTE donde esta modelada:

        hueso_posado = T @ pieza_objetivo @ pieza_rest^-1 @ hueso_rest

    T descuenta el desplazamiento lateral del diorama (las 5 poses estan una
    al lado de la otra en la escena); se mide con la cadera, que es el ancla
    natural del cuerpo, de modo que la pose se reproduce "en el sitio".

    Esa matriz exacta lleva traslacion propia, y ahi esta el problema: la
    traslacion vive en el basis local del hueso y se interpola en linea recta
    mientras el padre gira, asi que entre fotogramas el hueso se despega de su
    padre -es lo que hacia que los pies "saltaran" en vez de acompanar a la
    pierna-. Por eso se prueba primero una version que SOLO GIRA, dejando que
    la posicion la ponga la cadena; solo si esa version deja la pieza a mas de
    TOLERANCIA_FK de donde el autor la modelo se usa la matriz exacta. Las
    piernas (SOLO_GIRO) nunca trasladan: alli manda el arco natural."""
    desfase = (objetivo["hips"]["m"].translation - bind["hips"]["m"].translation)
    T = Matrix.Translation(-desfase)

    out = {}
    for nombre in BONE_NAMES:
        padre = PARENT_OF[nombre]
        padre_obj = out[padre] if padre else Matrix.Identity(4)
        padre_rest = rest_world[padre] if padre else Matrix.Identity(4)
        natural = padre_obj @ padre_rest.inverted() @ rest_world[nombre]

        pieza = PIECE_OF_BONE.get(nombre)
        if not (pieza and pieza in bind and pieza in objetivo):
            out[nombre] = natural
            continue

        exacta = (T @ objetivo[pieza]["m"]
                  @ bind[pieza]["m"].inverted() @ rest_world[nombre])
        solo_giro = Matrix.Translation(natural.translation) @ exacta.to_3x3().to_4x4()

        # cuanto se aparta la pieza si el hueso solo gira
        inv = rest_world[nombre].inverted()
        err = 0.0
        for c in bind[pieza]["bbox"]:
            p = bind[pieza]["m"] @ Vector(c)
            err = max(err, ((solo_giro @ inv @ p) - (exacta @ inv @ p)).length)

        forzado = nombre in SOLO_GIRO
        out[nombre] = solo_giro if (forzado or err <= TOLERANCIA_FK) else exacta
        if registro is not None and err > TOLERANCIA_FK:
            registro.append((nombre, err, forzado))
    return out


# Piezas que se intercambian para fabricar el apoyo contrario de la caminata.
# Solo las piernas: los brazos sostienen la libreta y el lapiz, y espejarlos
# tambien les suelta las manos de lo que llevan (los accesorios no se espejan,
# porque no tienen lado). Caminar moviendo solo las piernas y manteniendo el
# agarre es ademas lo que hace alguien que camina tomando notas.
PAREJAS_ESPEJO = [
    ("leg_upper_L", "leg_upper_R"),
    ("leg_lower_L", "leg_lower_R"),
    ("shoe_l", "shoe_R"),
]


def pose_espejada(bind, objetivo):
    """El apoyo contrario de la caminata, a partir de la unica zancada modelada.

    Se espeja a nivel de PIEZA, no de hueso: para cada miembro se toma el
    movimiento que hizo el lado contrario respecto al reposo, se refleja en el
    plano X=0 y se aplica a la pieza de este lado. Reflejar el delta (y no la
    posicion absoluta) evita depender de que el esqueleto sea perfectamente
    simetrico, que no lo es -los huesos salen del eje largo de cada pieza y
    las del lado derecho estan modeladas con escala X negativa-.

    Torso, cabeza y accesorios se quedan como en la zancada original: en una
    caminata no se voltean."""
    Mx = Matrix.Diagonal((-1.0, 1.0, 1.0, 1.0))

    # Primero se trae el bucket a su sitio: las 5 poses estan una al lado de
    # la otra, y ese desplazamiento (~8.8 m en X para la caminata) va dentro
    # del delta. Reflejarlo sin quitarlo le cambia el signo y manda los
    # miembros al otro lado del mapa.
    desfase = objetivo["hips"]["m"].translation - bind["hips"]["m"].translation
    T = Matrix.Translation(-desfase)
    out = {k: {**v, "m": T @ v["m"]} for k, v in objetivo.items()}

    for a, b in PAREJAS_ESPEJO:
        if not all(k in objetivo and k in bind for k in (a, b)):
            continue
        for aqui, alla in ((a, b), (b, a)):
            delta = (T @ objetivo[alla]["m"]) @ bind[alla]["m"].inverted()
            out[aqui]["m"] = (Mx @ delta @ Mx) @ bind[aqui]["m"]
    return out


def descendientes(raiz):
    """El hueso y todo lo que cuelga de el."""
    fuera = [raiz]
    i = 0
    while i < len(fuera):
        actual = fuera[i]
        i += 1
        fuera += [b for b, p in JERARQUIA if p == actual]
    return set(fuera)


def girar_cadena(objetivo, raiz, grados, eje="X"):
    """Gira la subcadena entera alrededor de la cabeza del hueso raiz.

    Hace falta aplicarlo a TODA la subcadena porque cada hueso lleva su matriz
    de mundo ya resuelta: mover solo el padre no arrastraria a los hijos."""
    hijos = descendientes(raiz)
    pivote = objetivo[raiz].to_translation()
    R = (Matrix.Translation(pivote)
         @ Matrix.Rotation(math.radians(grados), 4, eje)
         @ Matrix.Translation(-pivote))
    return {n: (R @ m if n in hijos else m) for n, m in objetivo.items()}


def mover_cadena(objetivo, raiz, desplazamiento):
    hijos = descendientes(raiz)
    T = Matrix.Translation(desplazamiento)
    return {n: (T @ m if n in hijos else m) for n, m in objetivo.items()}


def poner_pose(arm, objetivo):
    for nombre in BONE_NAMES:
        arm.pose.bones[nombre].matrix = objetivo[nombre]
        bpy.context.view_layer.update()


def reposo(arm):
    for pb in arm.pose.bones:
        pb.matrix_basis = Matrix.Identity(4)


def clavar(arm, frame):
    for pb in arm.pose.bones:
        pb.keyframe_insert(data_path="rotation_quaternion", frame=frame)
        pb.keyframe_insert(data_path="location", frame=frame)
        pb.keyframe_insert(data_path="scale", frame=frame)


def nueva_accion(arm, nombre):
    if nombre in bpy.data.actions:
        bpy.data.actions.remove(bpy.data.actions[nombre])
    accion = bpy.data.actions.new(nombre)
    arm.animation_data.action = accion
    return accion


def suavizar(accion, easing=None):
    for fc in accion.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = "BEZIER"
            if easing:
                kp.easing = easing


def respiracion(objetivo, grados=1.3, alto=0.009):
    """La misma pose, un pelin mas erguida: el otro extremo del bucle."""
    return mover_cadena(girar_cadena(objetivo, "chest", -grados),
                        "root", Vector((0.0, 0.0, alto)))


def accion_gesto(arm, nombre, objetivo, largo=72):
    """La pose, SOSTENIDA en bucle con una respiracion minima.

    No lleva la entrada desde el reposo ni la vuelta: de eso se encarga el
    crossfade de reproducir() (medio segundo), igual que en los gestos de K-7.
    Antes el clip era 'reposo -> pose -> reposo' y se tocaba una sola vez, asi
    que el gesto se caia a los dos segundos y el resto del mensaje ella se
    quedaba en reposo; ahora se mantiene mientras dure el mensaje y solo lo
    deja cuando el guion pide otra cosa.

    Los fotogramas 0 y `largo` son identicos para que el bucle no salte."""
    accion = nueva_accion(arm, nombre)
    poner_pose(arm, objetivo);              clavar(arm, 0)
    poner_pose(arm, respiracion(objetivo)); clavar(arm, largo // 2)
    poner_pose(arm, objetivo);              clavar(arm, largo)
    suavizar(accion, "EASE_IN_OUT")
    return accion


def accion_caminar(arm, rest_world, bind, datos_pose):
    """Ciclo: apoyo A -> apoyo B (espejado) -> apoyo A, para que enlace.

    A la zancada modelada se le suma el vaiven de brazos que pide un walk
    cycle: cada brazo va al contrario de su pierna, girando desde el hombro.
    Se gira la cadena entera del brazo para que antebrazo, mano y lo que
    lleve (lapiz, libreta) acompanen."""
    accion = nueva_accion(arm, "Profesora_Caminando")
    a = matrices_objetivo(rest_world, bind, datos_pose)
    b = matrices_objetivo(rest_world, bind, pose_espejada(bind, datos_pose))

    a = girar_cadena(girar_cadena(a, "upperarm_L", BALANCEO_BRAZOS),
                     "upperarm_R", -BALANCEO_BRAZOS)
    b = girar_cadena(girar_cadena(b, "upperarm_L", -BALANCEO_BRAZOS),
                     "upperarm_R", BALANCEO_BRAZOS)

    poner_pose(arm, a); clavar(arm, 0)
    poner_pose(arm, b); clavar(arm, 16)
    poner_pose(arm, a); clavar(arm, 32)
    suavizar(accion)
    return accion


def accion_escribir(arm, nombre, objetivo, largo=72, mano="hand_L"):
    """Como accion_gesto, en bucle sostenido, pero aqui la vida del bucle no
    es la respiracion sino la mano del lapiz yendo y viniendo sobre la
    libreta."""
    accion = nueva_accion(arm, nombre)
    d = TRAZO_ESCRIBIR
    for i in range(9):                      # 0, 1/8, 2/8 ... del ciclo
        f = round(largo * i / 8)
        s = (0, 1, 0, -1, 0, 1, 0, -1, 0)[i]
        poner_pose(arm, mover_cadena(objetivo, mano,
                                     Vector((d * s, d * 0.35 * s, -abs(d * s) * 0.25))))
        clavar(arm, f)
    suavizar(accion)
    return accion


def accion_idle(arm, largo=60):
    """Respiracion y balanceo suave sobre la pose de reposo."""
    accion = nueva_accion(arm, "Profesora_Idle")
    reposo(arm)
    pistas = [
        ("chest", (1, 0, 0), [0.0, 1.6, 0.0, -1.1, 0.0]),
        ("head", (0, 0, 1), [0.0, 2.8, 0.0, -2.8, 0.0]),
        ("head", (1, 0, 0), [0.0, -1.4, 0.0, 1.2, 0.0]),
        ("upperarm_L", (1, 0, 0), [0.0, 2.2, 0.0, -1.6, 0.0]),
        ("upperarm_R", (1, 0, 0), [0.0, -1.6, 0.0, 2.2, 0.0]),
    ]
    frames = [0, largo // 4, largo // 2, 3 * largo // 4, largo]
    for hueso, eje, grados in pistas:
        pb = arm.pose.bones[hueso]
        for f, g in zip(frames, grados):
            pb.rotation_quaternion = Quaternion(eje, math.radians(g))
            pb.keyframe_insert(data_path="rotation_quaternion", frame=f)
        pb.rotation_quaternion = Quaternion((1, 0, 0, 0))

    root = arm.pose.bones["root"]
    for f, z in zip(frames, [0.0, 0.011, 0.0, -0.007, 0.0]):
        root.location = (0.0, 0.0, z)
        root.keyframe_insert(data_path="location", frame=f)
    root.location = (0.0, 0.0, 0.0)

    suavizar(accion)
    reposo(arm)
    return accion


# ============================================================ 5. previews ====

def luces():
    # fondo neutro y apagado: con el world que arrastra el .blend el casco del
    # contorno pillaba brillo del entorno y las previews salian con un halo
    # claro que no existe en el visor
    w = bpy.data.worlds.new("PreviewWorld")
    w.use_nodes = True
    w.node_tree.nodes["Background"].inputs[0].default_value = (0.16, 0.17, 0.19, 1)
    w.node_tree.nodes["Background"].inputs[1].default_value = 0.35
    bpy.context.scene.world = w

    for n, loc, rot, e in (("Key", (3.0, -3.5, 4.0), (math.radians(45), 0, math.radians(38)), 400),
                           ("Fill", (-4.0, -3.0, 2.0), (math.radians(70), 0, math.radians(-52)), 180)):
        d = bpy.data.lights.new(n, "AREA")
        d.energy, d.size = e, 6
        ob = bpy.data.objects.new(n, d)
        ob.location, ob.rotation_euler = loc, rot
        bpy.context.scene.collection.objects.link(ob)


def render(path, loc, mira=(0, 0, 1.15)):
    d = bpy.data.cameras.new("Cam")
    d.lens = 78
    cam = bpy.data.objects.new("Cam", d)
    bpy.context.scene.collection.objects.link(cam)
    bpy.context.scene.camera = cam
    cam.location = loc
    cam.rotation_euler = (Vector(mira) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

    scn = bpy.context.scene
    scn.render.engine = "BLENDER_EEVEE_NEXT"
    scn.view_settings.view_transform = "Standard"
    scn.render.resolution_x, scn.render.resolution_y = 620, 900
    scn.render.image_settings.file_format = "PNG"
    scn.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    bpy.data.cameras.remove(d)


# ================================================================== main ====

def main():
    src = SRC_BLEND if os.path.exists(SRC_BLEND) else FALLBACK_BLEND
    bpy.ops.wm.open_mainfile(filepath=src)
    print(f"[fuente] {os.path.basename(src)}")

    objs = recoger_piezas()
    datos = fotografiar(objs)
    bind = objs[BIND]
    print(f"[bind] {len(bind)} piezas en la pose '{BIND}'")

    # las 5 copias deben compartir geometria local; si no, el retarget miente
    for pose in BUCKETS:
        raras = [k for k, d in datos[pose].items()
                 if k in datos[BIND] and d["verts"] != datos[BIND][k]["verts"]]
        if raras:
            print(f"  ! {pose}: piezas con distinto numero de vertices que el bind: {raras}")

    cruzadas = comprobar_lados(datos[BIND])
    if cruzadas:
        print("[lados] piezas asignadas a un hueso del lado contrario:")
        for pieza, hueso, x in cruzadas:
            print(f"    {pieza:16s} esta en x={x:+.3f} pero va a {hueso}")

    sueltas = piezas_sueltas(datos)
    if sueltas:
        print("[piezas sueltas] no siguen a su hueso, se les da uno propio:")
        for pieza, (hueso, err) in sorted(sueltas.items(), key=lambda kv: -kv[1][1]):
            print(f"    {pieza:16s} colgaba de {hueso:12s} desviacion max {err*100:.1f} cm")
        registrar_huesos_de_pieza(sueltas)

    enlazar_a_raiz(bind)
    quitar_otras_poses(objs, BIND)

    aplanar_transformadas(bind)
    ojos = tenir_ojos(bind)
    armonizados = armonizar_con_k7(bind)
    avivados = saturar_ropa(bind)
    rehacer_contorno(bind)
    n_mats = igualar_emision(bind)
    print(f"[materiales] {n_mats} revisados, contorno rehecho a {GROSOR_CONTORNO} "
          f"en mundo, cara con los materiales de K-7 ({', '.join(ojos)})")
    print(f"[paleta] armonizados con K-7: {', '.join(armonizados)}")
    print(f"[saturacion] {', '.join(avivados)}")

    huesos = esqueleto_de_geometria(datos[BIND])
    cuenta = asignar_pesos(bind)
    arm = construir_armature(huesos)
    rest_world = {b.name: b.matrix_local.copy() for b in arm.data.bones}
    malla = unir_y_emparentar(bind, arm)

    arm.animation_data_create()
    idle = accion_idle(arm)

    registro = []
    objetivos = {p: matrices_objetivo(rest_world, datos[BIND], datos[p], registro)
                 for p in ("escribiendo", "eureka", "mirando", "caminando")}
    if registro:
        peor = {}
        for hueso, err, forzado in registro:
            v, _ = peor.get(hueso, (0, forzado))
            peor[hueso] = (max(v, err), forzado)
        print("[traslacion] huesos a los que no les basta con girar:")
        for hueso, (err, forzado) in sorted(peor.items(), key=lambda kv: -kv[1][0]):
            nota = "  (SOLO_GIRO: se acepta y se queda girando)" if forzado else ""
            print(f"    {hueso:14s} girando solo se iria {err*100:.1f} cm{nota}")

    accion_escribir(arm, "Profesora_Escribiendo", objetivos["escribiendo"])
    accion_gesto(arm, "Profesora_Eureka", objetivos["eureka"])
    accion_gesto(arm, "Profesora_Mirando", objetivos["mirando"])
    accion_caminar(arm, rest_world, datos[BIND], datos["caminando"])

    arm.animation_data.action = idle
    reposo(arm)

    # fuera cualquier objeto huerfano que arrastre el .blend (un Icosphere
    # suelto, igual que el que ya describia rig_cubehead.py para K-7)
    for o in list(bpy.data.objects):
        if o not in (malla, arm):
            bpy.data.objects.remove(o, do_unlink=True)

    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    seleccionar([malla, arm], activo=arm)
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB, export_format="GLB", use_selection=True,
        export_apply=False, export_animations=True,
        export_animation_mode="ACTIONS", export_skins=True, export_yup=True,
    )
    print(f"[export] {OUT_GLB} ({os.path.getsize(OUT_GLB)//1024} KB)")
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)

    luces()
    render(os.path.join(HERE, "preview_profesora_reposo.png"), (0.0, -5.4, 1.35))
    for pose, accion in (("escribiendo", "Profesora_Escribiendo"),
                         ("eureka", "Profesora_Eureka"),
                         ("mirando", "Profesora_Mirando"),
                         ("caminando", "Profesora_Caminando")):
        arm.animation_data.action = bpy.data.actions[accion]
        # los gestos son bucles sostenidos: cualquier fotograma sirve. En la
        # caminata se mira el apoyo ESPEJADO (frame 16), que es el fabricado y
        # por tanto el que hay que revisar
        bpy.context.scene.frame_set(16 if pose == "caminando" else 0)
        bpy.context.view_layer.update()
        render(os.path.join(HERE, f"preview_profesora_{pose}.png"), (2.9, -4.6, 1.7))
        reposo(arm)

    print("\n" + "=" * 54)
    print(f"  piezas           : {len(bind)}")
    print(f"  huesos           : {len(arm.data.bones)}")
    print(f"  triangulos       : {len(malla.data.loop_triangles)}")
    print(f"  piezas por hueso : {cuenta}")
    print(f"  acciones         : {sorted(a.name for a in bpy.data.actions)}")
    print("=" * 54)


if __name__ == "__main__":
    main()

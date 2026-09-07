"""
Prepara los ojos intercambiables de K-7 y le quita los ojos basicos soldados.

    blender -b -P build_ojos.py

Analogo a build_bocas.py: quita del robot los ojos basicos soldados al hueso
'head' (iris + brillos, con su cascara de contorno mas ajustada; el marco de
las gafas y su cascara, mucho mas grandes, se quedan puestos) y exporta los
cinco pares de ojos de referencias/Ojos.blend a docs/ojos.glb, normalizados
igual que las bocas: centrados en x, con el borde de arriba en z=0 y a la
escala en que los ojos normales miden 1 de ancho total.

Se puede volver a ejecutar: si los ojos basicos ya no estan, avisa y sigue.

Salidas: docs/robot.glb (sin los ojos basicos) y docs/ojos.glb (los cinco pares)
"""

import bpy
import mathutils
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROBOT = os.path.join(HERE, "docs", "robot.glb")
OJOS_BLEND = os.path.join(HERE, "referencias", "Ojos.blend")
OJOS_GLB = os.path.join(HERE, "docs", "ojos.glb")

# coleccion en Ojos.blend -> nombre con el que sale al GLB
GRUPOS = {
    "Ojitos normal":    "normal",
    "tristes":          "triste",
    "Hojo guiñado":     "guino",
    "Hojo guiñado.001": "doble_guino",
    "confuindido":      "pensando",
}
REFERENCIA = "Ojitos normal"   # la que define la escala: su ancho vale 1
TINTA = (0.153, 0.204, 0.278)


def limpiar():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)


# --------------------------------------------- 1. quitar los ojos basicos ---

def piezas(ob, mats):
    """Agrupa en trozos sueltos las caras de esos materiales (ver build_bocas.py)."""
    me = ob.data
    caras = [p for p in me.polygons if p.material_index in mats]
    padre = {v: v for p in caras for v in p.vertices}

    def raiz(a):
        while padre[a] != a:
            padre[a] = padre[padre[a]]
            a = padre[a]
        return a

    def unir(a, b):
        ra, rb = raiz(a), raiz(b)
        if ra != rb:
            padre[ra] = rb

    soldado = {}
    for p in caras:
        for v in p.vertices:
            k = tuple(round(c, 5) for c in me.vertices[v].co)
            if k in soldado:
                unir(v, soldado[k])
            else:
                soldado[k] = v
            unir(p.vertices[0], v)

    grupos = {}
    for p in caras:
        grupos.setdefault(raiz(p.vertices[0]), set()).update(p.vertices)
    return list(grupos.values())


def caja(ob, idx):
    co = [ob.data.vertices[i].co for i in idx]
    return ((min(c.x for c in co), max(c.x for c in co)),
            (min(c.y for c in co), max(c.y for c in co)),
            (min(c.z for c in co), max(c.z for c in co)))


def de_la_cara(ob, idx):
    """Delante del plano de la cara y colgando del hueso 'head'."""
    if caja(ob, idx)[1][1] > -0.2:
        return False
    for i in idx:
        g = ob.data.vertices[i].groups
        if not g:
            return False
        if ob.vertex_groups[max(g, key=lambda x: x.weight).group].name != "head":
            return False
    return True


def contiene(fuera, dentro, margen=0.035):
    """fuera envuelve a dentro de cerca (cascara de contorno de esa pieza),
    no de lejos (el marco de las gafas, mucho mas grande, tambien las
    envuelve, pero no debe contarse)."""
    (fx0, fx1), _, (fz0, fz1) = fuera
    (dx0, dx1), _, (dz0, dz1) = dentro
    return (fx0 <= dx0 + 1e-4 and fx1 >= dx1 - 1e-4 and
            fz0 <= dz0 + 1e-4 and fz1 >= dz1 - 1e-4 and
            (fx1 - fx0) - (dx1 - dx0) < margen and
            (fz1 - fz0) - (dz1 - dz0) < margen)


def ojos(ob):
    """Los ojos basicos: iris de tinta + brillos blancos, delante de la cara,
    cada uno con su cascara de contorno ajustada. El marco de las gafas usa la
    misma tinta de contorno pero es mucho mas grande, y ese se queda puesto."""
    me = ob.data
    # el brillo blanco del ojo va con el material que hace de 'claro' en cada
    # modelo: M_white en el Modelo1, QB_gris en el Modelo2/3 (ver paleta.js)
    tinta = {i for i, m in enumerate(me.materials) if m and "navy" in m.name.lower()}
    blanco = {i for i, m in enumerate(me.materials)
              if m and m.name.lower().startswith(("m_white", "qb_gris"))}
    contorno = {i for i, m in enumerate(me.materials) if m and "outline" in m.name.lower()}

    nucleo = [idx for mats in (tinta, blanco) for idx in piezas(ob, mats) if de_la_cara(ob, idx)]
    cascaras = [idx for idx in piezas(ob, contorno) if de_la_cara(ob, idx)]

    quitar = set()
    for idx in nucleo:
        quitar |= idx
        caja_n = caja(ob, idx)
        candidatas = [c for c in cascaras if contiene(caja(ob, c), caja_n)]
        if candidatas:
            quitar |= min(candidatas, key=len)
    return quitar, [idx for idx in piezas(ob, tinta) if de_la_cara(ob, idx)]


# reusa tal cual el relleno de rendijas de build_bocas.py: opera sobre todo el
# plano frontal de la cabeza, asi que tapa igual los huecos que deje la boca
# o los ojos
def cara_frontal(ob):
    me = ob.data
    planos = {}
    for p in me.polygons:
        if p.normal.y > -0.9 or not de_la_cara(ob, p.vertices):
            continue
        planos.setdefault(round(p.center.y, 3), []).append(p)
    if not planos:
        return None, []
    y = max(planos, key=lambda k: sum(p.area for p in planos[k]))
    return y, planos[y]


def rendijas(ob, caras):
    """El contorno tambien tiene caras de frente en este mismo plano (el
    marco de las gafas), y suele ser lo mas cercano a un hueco de ojo/boca
    recien abierto. Si se dejara elegir como vecino, el parche saldria del
    color de la tinta del contorno -o, peor, del Modelo3, donde el cubo
    volteado deja la cara real fuera de este plano y el contorno es lo
    unico que hay: ahi el "hueco" no es tal, es solo el hueco del ojo/boca
    que ya va a tapar la malla dinamica de encima, y remendarlo con un
    cuadro solo deja ver un parche de mas asomando junto al marco. Por
    eso un hueco sin ningun vecino de relleno de verdad no se tapa: se dejan
    esos huecos tal cual."""
    me = ob.data
    outline = {i for i, m in enumerate(me.materials) if m and "outline" in m.name.lower()}
    puestas = []
    for p in caras:
        co = [me.vertices[i].co for i in p.vertices]
        puestas.append((min(c.x for c in co), max(c.x for c in co),
                        min(c.z for c in co), max(c.z for c in co), p.material_index))
    xs = sorted({v for c in puestas for v in c[:2]})
    zs = sorted({v for c in puestas for v in c[2:4]})

    huecos, llenas = [], []
    for x0, x1 in zip(xs, xs[1:]):
        for z0, z1 in zip(zs, zs[1:]):
            cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
            tapa = next((c for c in puestas
                         if c[0] <= cx <= c[1] and c[2] <= cz <= c[3]), None)
            (llenas if tapa else huecos).append(
                (cx, cz, tapa[4]) if tapa else (x0, x1, z0, z1, cx, cz))

    rellenas = [c for c in llenas if c[2] not in outline]
    if not rellenas:
        return []  # este plano es solo el marco: no hay nada bueno que copiar
    faltan = []
    for x0, x1, z0, z1, cx, cz in huecos:
        fila = [c for c in rellenas if abs(c[1] - cz) < 1e-6] or rellenas
        faltan.append((x0, x1, z0, z1, min(fila, key=lambda c: (abs(c[0] - cx), c[0]))[2]))
    return faltan


def poner_baldosas(ob, y, faltan):
    import bmesh
    me = ob.data
    bm = bmesh.new()
    bm.from_mesh(me)
    peso = bm.verts.layers.deform.verify()
    hueso = ob.vertex_groups["head"].index
    for x0, x1, z0, z1, mat in faltan:
        vs = [bm.verts.new((x, y, z))
              for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]
        for v in vs:
            v[peso][hueso] = 1.0
        bm.faces.new(vs).material_index = mat
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()


def canonizar_materiales(mallas):
    """El Modelo1 viene de origen con los materiales renombrados a
    'M_magenta.002' y similares (colisiones de un merge viejo, ya cocinadas
    en el glb). paleta.js busca el nombre exacto ('M_magenta'), asi que con
    el sufijo puesto nunca lo encuentra y ese material se queda sin poder
    repintarse. Se le quita el sufijo numerico de Blender."""
    for ob in mallas:
        for m in ob.data.materials:
            if not m:
                continue
            limpio = re.sub(r"\.\d{3}$", "", m.name)
            if limpio != m.name and limpio not in bpy.data.materials:
                m.name = limpio


def quitar_ojos():
    limpiar()
    bpy.ops.import_scene.gltf(filepath=ROBOT)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    mallas = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == arm]

    print("  -- ojos basicos --")
    for ob in mallas:
        idx, iris = ojos(ob)
        if not idx:
            print(f"     {ob.name}: ya no los tiene")
            continue
        (x0, x1), (y0, y1), (z0, z1) = caja(ob, set().union(*iris))
        print(f"     {ob.name}: {len(idx)} verts | ancho total {x1 - x0:.4f} | "
              f"borde arriba z={z1:.4f} | cara y={y0:.4f}")
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="DESELECT")
        bpy.ops.object.mode_set(mode="OBJECT")
        for i in idx:
            ob.data.vertices[i].select = True
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.delete(type="VERT")
        bpy.ops.object.mode_set(mode="OBJECT")

    print("  -- rendijas de la cara --")
    for ob in mallas:
        y, caras = cara_frontal(ob)
        if y is None:
            continue
        faltan = rendijas(ob, caras)
        if not faltan:
            print(f"     {ob.name}: la cara ya esta entera")
            continue
        poner_baldosas(ob, y, faltan)
        print(f"     {ob.name}: {len(faltan)} baldosas puestas en y={y:.3f}")

    canonizar_materiales(mallas)

    for ob in bpy.data.objects:
        ob.select_set(ob is arm or ob in mallas)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=ROBOT, export_format="GLB", use_selection=True,
        export_apply=False, export_yup=True, export_animations=True,
        export_cameras=False, export_lights=False, export_skins=True,
    )
    print("  escrito", ROBOT, os.path.getsize(ROBOT) // 1024, "KB")


# ------------------------------------------------ 2. exportar los ojos -----

def material_canon(nombre, color, emision):
    m = bpy.data.materials.get(nombre)
    if m:
        return m
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = 1.0
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Emission Color"].default_value = (*emision, 1.0)
    b.inputs["Emission Strength"].default_value = 1.0
    m.use_backface_culling = True
    m.diffuse_color = (*color, 1.0)
    return m


def caja_local(objs):
    co = [v.co for ob in objs for v in ob.data.vertices]
    return ((min(c.x for c in co), max(c.x for c in co)),
            (min(c.y for c in co), max(c.y for c in co)),
            (min(c.z for c in co), max(c.z for c in co)))


def exportar_ojos():
    limpiar()
    bpy.ops.wm.open_mainfile(filepath=OJOS_BLEND)
    for ob in list(bpy.data.objects):
        if ob.type != "MESH":
            bpy.data.objects.remove(ob, do_unlink=True)

    for ob in bpy.data.objects:
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    colecciones = {c.name: [o for o in c.objects if o.type == "MESH"]
                   for c in bpy.data.collections}

    ref_ojos = [o for o in colecciones[REFERENCIA] if o.name.startswith("eye_")]
    (rx0, rx1), _, (_, rz1) = caja_local(ref_ojos)
    escala = 1.0 / (rx1 - rx0)
    # todos los gestos anclan al MISMO borde de arriba (el de los ojos
    # normales, abiertos): un ojo entrecerrado o guinado se cierra desde
    # abajo, no debe desplazar hacia arriba el punto del que cuelga

    m_navy = material_canon("M_navy", TINTA, [c * 0.2 for c in TINTA])
    m_white = material_canon("M_white", (0.96, 0.965, 0.975), (0.15, 0.15, 0.16))
    m_outline = material_canon("M_outline", (0, 0, 0), TINTA)

    print("  -- ojos --")
    for coleccion, nuevo in GRUPOS.items():
        objs = colecciones[coleccion]
        ojos_del_par = [o for o in objs if o.name.startswith("eye_")]
        (x0, x1), (y0, y1), (z0, z1) = caja_local(ojos_del_par)
        m = (mathutils.Matrix.Scale(escala, 4)
             @ mathutils.Matrix.Translation((-(x0 + x1) / 2, -(y0 + y1) / 2, -rz1)))
        for ob in objs:
            ob.data.transform(m)
            ob.location = (0.0, 0.0, 0.0)

        base = objs[0]
        if len(objs) > 1:
            bpy.ops.object.select_all(action="DESELECT")
            for ob in objs:
                ob.select_set(True)
            bpy.context.view_layer.objects.active = base
            bpy.ops.object.join()
        base.name = nuevo
        base.data.name = nuevo

        mats_viejos = list(base.data.materials)
        destino = []
        for vm in mats_viejos:
            n = (vm.name if vm else "").lower()
            if "navy" in n:
                destino.append(m_navy)
            elif n.startswith("m_white"):
                destino.append(m_white)
            else:
                destino.append(m_outline)
        # ojo: materials.clear() resetea a 0 el material_index de cada cara,
        # asi que hay que guardarlos antes y devolverlos despues de reponer
        # la lista (destino tiene el mismo largo y orden que mats_viejos)
        indices_viejos = [p.material_index for p in base.data.polygons]
        base.data.materials.clear()
        for mat in destino:
            base.data.materials.append(mat)
        for p, i in zip(base.data.polygons, indices_viejos):
            p.material_index = i

        (a0, a1), _, (b0, b1) = caja_local([base])
        print(f"     {nuevo:12s} ancho {a1 - a0:.3f}  alto {b1 - b0:.3f}  "
              f"({len(base.data.polygons)} caras)")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=OJOS_GLB, export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True, export_animations=False,
        export_cameras=False, export_lights=False,
    )
    print("  escrito", OJOS_GLB, os.path.getsize(OJOS_GLB) // 1024, "KB")


quitar_ojos()
exportar_ojos()

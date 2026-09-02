"""
Prepara las bocas intercambiables de K-7 y le quita la sonrisa soldada.

    blender -b -P build_bocas.py

El personaje venia con la sonrisa incrustada en la malla: cinco cajas soldadas
al hueso 'head' con peso rigido, cada una con su cascara de contorno. Para que
pueda cambiar de gesto hay que sacarla de ahi y sustituirla por mallas sueltas
que se enciendan y apaguen.

Este script hace las dos mitades:

  1. Abre docs/robot.glb y borra la sonrisa de los dos modelos, relleno y
     cascara: si se queda la cascara, la boca vieja sigue viendose como cinco
     rectangulos huecos. Las encuentra por piezas sueltas de tinta y de
     contorno que van delante del plano de la cara, cuelgan del hueso 'head' y
     quedan por debajo de las gafas. De paso mide donde estaba, que es donde
     habra que colgar las bocas nuevas.
  2. Abre bocas.blend y exporta sus cuatro bocas a docs/bocas.glb, todas
     normalizadas al mismo criterio: centradas en x, con el borde de arriba
     en z=0 y a la escala en que la sonrisa mide 1. Asi en three.js basta una
     posicion y una escala por modelo, y las cuatro caen en su sitio
     guardando entre ellas los tamanos relativos con que estan dibujadas.

Se puede volver a ejecutar: si la sonrisa ya no esta, avisa y sigue.

Salidas: docs/robot.glb (sin la sonrisa) y docs/bocas.glb (las cuatro bocas)
"""

import bpy
import mathutils
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROBOT = os.path.join(HERE, "docs", "robot.glb")
BOCAS_BLEND = os.path.join(HERE, "bocas.blend")
BOCAS_GLB = os.path.join(HERE, "docs", "bocas.glb")

# objeto en bocas.blend -> nombre con el que sale al GLB
NOMBRES = {
    "BocaFeliz":    "feliz",
    "Boca abierta": "abierta",
    "Pensando":     "pensando",
    "Sorpresa":     "sorpresa",
}
REFERENCIA = "BocaFeliz"      # la que define la escala: su ancho vale 1
TINTA = (0.153, 0.204, 0.278)


def limpiar():
    for ob in list(bpy.data.objects):
        bpy.data.objects.remove(ob, do_unlink=True)


# --------------------------------------------- 1. quitar la sonrisa vieja ---

def piezas(ob, mats):
    """Agrupa en trozos sueltos las caras de esos materiales.

    Suelda por posicion: el GLB trae cada caja con los vertices partidos por
    cara, asi que la conectividad de la malla, por si sola, dejaria cada caja
    en seis cuadrados sueltos en vez de en una pieza."""
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


def sonrisa(ob):
    """La sonrisa vieja: cinco cajas de tinta, cada una con su cascara de
    contorno. Sin la cascara la boca sigue ahi, hueca: se le ve el borde.

    Las gafas comparten material y sitio con ella, asi que lo que las separa es
    la altura. El borde de abajo del relleno de las gafas -lo unico de tinta
    que queda delante de la cara- marca el limite: por debajo solo esta la
    boca. Se le descuentan 3 cm de escala, que es lo que la cascara del
    contorno sobresale de su relleno.

    Devuelve los vertices a borrar y los del relleno, que son los que dan la
    medida buena de donde estaba."""
    me = ob.data
    tinta = {i for i, m in enumerate(me.materials) if "navy" in m.name.lower()}
    contorno = {i for i, m in enumerate(me.materials) if "outline" in m.name.lower()}

    delante = [(es_tinta, idx)
               for mats, es_tinta in ((tinta, True), (contorno, False))
               for idx in piezas(ob, mats) if de_la_cara(ob, idx)]

    gafas = [caja(ob, idx)[2][0] for es_tinta, idx in delante if es_tinta]
    if not gafas:
        return set(), set()
    limite = max(gafas) - 0.03

    boca = [(es_tinta, idx) for es_tinta, idx in delante
            if caja(ob, idx)[2][1] < limite]
    if not boca:
        return set(), set()
    return (set().union(*(idx for _, idx in boca)),
            set().union(set(), *(idx for es_tinta, idx in boca if es_tinta)))


def quitar_sonrisas():
    limpiar()
    bpy.ops.import_scene.gltf(filepath=ROBOT)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    mallas = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == arm]

    print("  -- sonrisa vieja --")
    for ob in mallas:
        idx, relleno = sonrisa(ob)
        if not idx:
            print(f"     {ob.name}: ya no la tiene")
            continue
        # el punto del que cuelgan las bocas nuevas: centro en x, labio de
        # arriba en z, y el plano en que se dibuja la cara. Lo mide el relleno;
        # si ya no esta, la cascara del contorno lo da un pelo mas grande
        (x0, x1), (y0, y1), (z0, z1) = caja(ob, relleno or idx)
        print(f"     {ob.name}: {len(idx)} verts "
              f"({'relleno y cascara' if relleno else 'solo la cascara'}) | "
              f"ancho {x1 - x0:.4f} | labio arriba z={z1:.4f} | cara y={y0:.4f}")
        bpy.context.view_layer.objects.active = ob
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.select_all(action="DESELECT")
        bpy.ops.object.mode_set(mode="OBJECT")
        for i in idx:
            ob.data.vertices[i].select = True
        bpy.ops.object.mode_set(mode="EDIT")
        bpy.ops.mesh.delete(type="VERT")
        bpy.ops.object.mode_set(mode="OBJECT")

    for ob in bpy.data.objects:
        ob.select_set(ob is arm or ob in mallas)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=ROBOT, export_format="GLB", use_selection=True,
        export_apply=False, export_yup=True, export_animations=True,
        export_cameras=False, export_lights=False, export_skins=True,
    )
    print("  escrito", ROBOT, os.path.getsize(ROBOT) // 1024, "KB")


# ------------------------------------------------ 2. exportar las bocas -----

def material_tinta():
    m = bpy.data.materials.get("M_navy")
    if m:
        return m
    # se llama M_navy a proposito: paleta.js reconoce ese nombre y le asigna
    # el rol 'oscuro', asi la boca cambia de color con el resto del personaje
    m = bpy.data.materials.new("M_navy")
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*TINTA, 1.0)
    b.inputs["Roughness"].default_value = 1.0
    b.inputs["Metallic"].default_value = 0.0
    b.inputs["Emission Color"].default_value = (*[c * 0.2 for c in TINTA], 1.0)
    b.inputs["Emission Strength"].default_value = 1.0
    m.use_backface_culling = True
    m.diffuse_color = (*TINTA, 1.0)
    return m


def caja_local(ob):
    co = [v.co for v in ob.data.vertices]
    return ((min(c.x for c in co), max(c.x for c in co)),
            (min(c.y for c in co), max(c.y for c in co)),
            (min(c.z for c in co), max(c.z for c in co)))


def exportar_bocas():
    limpiar()
    bpy.ops.wm.open_mainfile(filepath=BOCAS_BLEND)
    for ob in list(bpy.data.objects):
        if ob.type != "MESH":
            bpy.data.objects.remove(ob, do_unlink=True)

    for ob in bpy.data.objects:
        ob.select_set(True)
        bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    escala = 1.0 / (lambda c: c[0][1] - c[0][0])(caja_local(bpy.data.objects[REFERENCIA]))

    print("  -- bocas --")
    for viejo, nuevo in NOMBRES.items():
        ob = bpy.data.objects[viejo]
        (x0, x1), (y0, y1), (z0, z1) = caja_local(ob)
        # centro en x, borde de arriba en z=0, plano de la cara en y=0
        m = (mathutils.Matrix.Scale(escala, 4)
             @ mathutils.Matrix.Translation((-(x0 + x1) / 2, -(y0 + y1) / 2, -z1)))
        ob.data.transform(m)
        ob.location = (0.0, 0.0, 0.0)
        ob.name = nuevo
        ob.data.name = nuevo
        ob.data.materials.clear()
        ob.data.materials.append(material_tinta())
        for p in ob.data.polygons:
            p.material_index = 0
        (a0, a1), _, (b0, b1) = caja_local(ob)
        print(f"     {nuevo:9s} ancho {a1 - a0:.3f}  alto {b1 - b0:.3f}  "
              f"({len(ob.data.polygons)} caras)")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=BOCAS_GLB, export_format="GLB", use_selection=True,
        export_apply=True, export_yup=True, export_animations=False,
        export_cameras=False, export_lights=False,
    )
    print("  escrito", BOCAS_GLB, os.path.getsize(BOCAS_GLB) // 1024, "KB")


quitar_sonrisas()
exportar_bocas()

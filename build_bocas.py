"""
Prepara las bocas intercambiables de K-7 y le quita la sonrisa soldada.

    blender -b -P build_bocas.py

El personaje venia con la sonrisa incrustada en la malla: cinco cajas soldadas
al hueso 'head' con peso rigido. Para que pueda cambiar de gesto hay que
sacarla de ahi y sustituirla por mallas sueltas que se enciendan y apaguen.

Este script hace las dos mitades:

  1. Abre docs/robot.glb y borra la sonrisa de los dos modelos. La encuentra
     por material de tinta, por delante del plano de la cara y por debajo de
     las gafas: salen 60 caras y 120 vertices en cada uno. De paso mide donde
     estaba, que es donde habra que colgar las bocas nuevas.
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

def sonrisa(ob):
    """Los cinco segmentos: tinta, delante de la cara, por debajo de las
    gafas. Gafas y sonrisa comparten material, las separa el hueco en altura."""
    me = ob.data
    tinta = [i for i, m in enumerate(me.materials) if "navy" in m.name.lower()]
    caras = [p for p in me.polygons
             if p.material_index in tinta and p.center.y < -0.26 and p.center.z > 1.0]
    if not caras:
        return set(), None
    caras.sort(key=lambda p: p.center.z)

    grupo = [caras[0]]
    for p in caras[1:]:
        if p.center.z - grupo[-1].center.z > 0.04:
            break
        grupo.append(p)

    idx = set()
    for p in grupo:
        idx.update(p.vertices)
    co = [me.vertices[i].co for i in idx]
    caja = (
        (min(c.x for c in co), max(c.x for c in co)),
        (min(c.y for c in co), max(c.y for c in co)),
        (min(c.z for c in co), max(c.z for c in co)),
    )
    return idx, caja


def quitar_sonrisas():
    limpiar()
    bpy.ops.import_scene.gltf(filepath=ROBOT)
    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    mallas = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == arm]

    print("  -- sonrisa vieja --")
    for ob in mallas:
        idx, caja = sonrisa(ob)
        if not idx:
            print(f"     {ob.name}: ya no la tiene")
            continue
        (x0, x1), (y0, y1), (z0, z1) = caja
        # el punto del que cuelgan las bocas nuevas: centro en x, labio de
        # arriba en z, y el plano en que se dibuja la cara
        print(f"     {ob.name}: {len(idx)} verts | ancho {x1 - x0:.4f} | "
              f"labio arriba z={z1:.4f} | cara y={y0:.4f}")
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

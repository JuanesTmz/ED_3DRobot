"""
Prepara los implementos del aula (silla, mesa, tablero) para el fondo de K-7.

    blender -b ImplementosFondo.blend -P build_implementos.py

Cada pieza sale del .blend repartida en varios objetos sueltos; aqui se juntan
en tres mallas limpias, se normalizan (mirando al frente, apoyadas en el suelo,
centradas y a la escala del robot) y se les pone el acabado de boceto: relleno
blanco hueso y contorno oscuro por cascara invertida, la misma tecnica que usa
build_character.py para el personaje.

Salida: docs/implementos.glb  ->  mallas 'Mesa', 'Silla', 'Tablero'
"""

import bpy
import bmesh
import os
import math
import mathutils


HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "docs", "implementos.glb")

# El robot mide 1.95 unidades de alto: los muebles se miden contra el.
# El relleno lleva algo de emision: la luz de la escena tiene el suelo azul
# grisaceo y sin ella las caras en sombra viran a gris frio, no a hueso.
HUESO = (0.800, 0.765, 0.680)   # blanco calido, papel viejo
BRILLO = (0.360, 0.332, 0.270)  # emision del relleno
TINTA = (0.153, 0.204, 0.278)   # el mismo navy que contornea a K-7

# nombre -> (objetos del .blend, alto final en unidades, grosor del contorno)
# El contorno va mas grueso que en el robot (0.019): los muebles estan al
# fondo y a esa distancia un trazo fino se pierde.
PIEZAS = {
    "Mesa":    (["Mesa", "MesaPatas"],                                         0.80, 0.024),
    "Silla":   (["Silla", "Patas0", "Patas1", "Soporte", "soporte1", "Espaldar"], 1.00, 0.022),
    "Tablero": (["Tablero"],                                                   1.10, 0.028),
}


# ------------------------------------------------------------- utilidades ---

def limpiar():
    """Fuera luces y camara: solo se exportan mallas."""
    for ob in list(bpy.data.objects):
        if ob.type != "MESH":
            bpy.data.objects.remove(ob, do_unlink=True)


def unir(nombre, nombres):
    """Junta varios objetos en uno solo y le aplica todas las transformadas."""
    obs = [bpy.data.objects[n] for n in nombres if n in bpy.data.objects]
    if not obs:
        raise SystemExit("falta la pieza " + nombre)

    bpy.ops.object.select_all(action="DESELECT")
    for ob in obs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1:
        bpy.ops.object.join()

    ob = bpy.context.object
    ob.name = nombre
    ob.data.name = nombre
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob


def normales_fuera(ob):
    """La cascara invertida solo funciona si las normales miran hacia fuera."""
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")


def transformar_malla(ob, matriz):
    """Aplica una matriz directamente a los vertices, sin tocar el objeto."""
    me = ob.data
    me.transform(matriz)
    me.update()


def normalizar(ob, alto, giro_z):
    """Mira al frente (+Z de three.js), se apoya en el suelo y queda centrada."""
    transformar_malla(ob, mathutils.Matrix.Rotation(giro_z, 4, "Z"))

    co = [v.co for v in ob.data.vertices]
    minv = mathutils.Vector((min(c[i] for c in co) for i in range(3)))
    maxv = mathutils.Vector((max(c[i] for c in co) for i in range(3)))

    factor = alto / max(maxv.z - minv.z, 1e-6)
    centro = mathutils.Vector(((minv.x + maxv.x) / 2, (minv.y + maxv.y) / 2, minv.z))

    m = mathutils.Matrix.Scale(factor, 4) @ mathutils.Matrix.Translation(-centro)
    transformar_malla(ob, m)
    ob.location = (0.0, 0.0, 0.0)
    return (maxv - minv) * factor


# -------------------------------------------------------------- materiales --

def material(nombre, color, emision, contorno=False):
    m = bpy.data.materials.get(nombre)
    if m:
        return m
    m = bpy.data.materials.new(nombre)
    m.use_nodes = True
    bsdf = m.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = ((0, 0, 0, 1) if contorno
                                              else (*color, 1.0))
    bsdf.inputs["Roughness"].default_value = 1.0 if contorno else 0.85
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["Emission Color"].default_value = (*emision, 1.0)
    bsdf.inputs["Emission Strength"].default_value = 1.0
    # Sin esto Blender exporta doubleSided y three.js sombrea tambien las
    # caras internas, que nunca se ven: son solidos cerrados. En el contorno
    # ademas es lo que deja ver solo la silueta.
    m.use_backface_culling = True
    m.diffuse_color = (*color, 1.0)
    return m


def acabado_boceto(ob, grosor):
    """Relleno hueso + cascara invertida oscura, horneada en la geometria."""
    ob.data.materials.clear()
    ob.data.materials.append(material("M_hueso", HUESO, BRILLO))
    ob.data.materials.append(material("M_outline_bg", TINTA, TINTA, contorno=True))
    for p in ob.data.polygons:
        p.material_index = 0

    mod = ob.modifiers.new("outline", "SOLIDIFY")
    mod.thickness = grosor
    mod.offset = 1.0
    mod.use_flip_normals = True
    mod.use_rim = False
    mod.material_offset = 1
    mod.material_offset_rim = 1

    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)
    assert not ob.modifiers, "el contorno no se horneo en " + ob.name


# ------------------------------------------------------------------ main ----

def main():
    limpiar()

    for nombre, (partes, alto, grosor) in PIEZAS.items():
        ob = unir(nombre, partes)
        normales_fuera(ob)
        # silla y tablero nacen mirando a +X; con -90 en Z quedan mirando a -Y,
        # que es el +Z de three.js (el lado de la camara)
        dims = normalizar(ob, alto, -math.pi / 2)
        acabado_boceto(ob, grosor)
        print(f"  {nombre}: {dims.x:.2f} x {dims.y:.2f} x {dims.z:.2f}  "
              f"({len(ob.data.polygons)} caras)")

    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=OUT,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_yup=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    print("escrito", OUT, os.path.getsize(OUT) // 1024, "KB")


main()

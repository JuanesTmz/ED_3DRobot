"""
Anade el tercer modelo de K-7: el CubeHead con la cabeza volteada.

    blender -b -P build_modelo3.py

Entra y sale por docs/robot.glb. Duplica Modelo2 en Modelo3 -mismo armature,
misma accion, mismos materiales- y le hace tres cosas a la cabeza:

  1. gira el cubo sobre su centro, hasta la pose de 'cabeza girada.blend'
  2. baja la carita -gafas, ojos, brillos, puente y patillas- porque en esa
     pose la esquina del cubo le cae justo encima y la tapaba
  3. le quita las baldosas con que build_bocas.py tapo el hueco de la sonrisa
     vieja: el cubo esta disenado con agujeros cuadrados en las caras, y
     girado ese parche se lee como una cara maciza donde deberia verse hueco.
     En Modelo2 el parche se queda, que alli el hueco da de frente.

Es el encuadre de referencia.png con la carita de mover carita.png: el cubo
apoyado en una esquina, y la cara y las gafas mirando al frente.

Corre DESPUES de build_bocas.py, no antes. build_bocas.py encuentra la sonrisa
vieja y las baldosas que le faltan a la cara por geometria, dando por hecho que
la cara mira a -Y; con el cubo girado esa busqueda se iria a las gafas, que son
lo unico que sigue plano de frente. Girando al final, Modelo3 hereda una cara
ya entera y sin sonrisa soldada.

    blender -b robot_cubehead_solo.blend -P rig_cubehead.py   ->  Modelo1 + Modelo2
    blender -b -P build_bocas.py                              ->  sin sonrisa
    blender -b -P build_modelo3.py                            ->  + Modelo3

Se puede volver a ejecutar: si Modelo3 ya esta, lo tira y lo rehace.

Salida: docs/robot.glb (armature + Modelo1 + Modelo2 + Modelo3 + Idle)
"""

import os
import math
import bpy
import mathutils

HERE = os.path.dirname(os.path.abspath(__file__))
ROBOT = os.path.join(HERE, "docs", "robot.glb")

ORIGEN = "Modelo2"   # el CubeHead, del que sale el tercero
NUEVO = "Modelo3"

# La pose de 'cabeza girada.blend', donde se dibujo a mano como debe verse el
# cubo de frente. Euler XYZ en grados, sobre el centro del cubo.
GIRO = (24.113, -22.659, 41.852)

# Cuanto baja la carita, en unidades de mundo. Medido sobre mover carita.png:
# alli las gafas quedan al 62% de la altura del cubo contando desde arriba, y
# el cubo girado va de z=1.8896 a z=0.8904, asi que su centro cae en z=1.270.
# Estaban en z=1.50.
BAJAR = 0.23

# Cuanto se separan el cubo y la carita del cuerpo, cada uno por su lado.
# Salieron de cuadrarlo a ojo con el panel ?dev=1 del visor (ya retirado):
# cubo y carita quedaban muy pegados al cuerpo tras el giro, y ademas la
# carita necesitaba su propio ajuste fino, distinto al del cubo.
SUBIR_CABEZA = 0.068     # cubo: sube en Z
ATRAS_CABEZA = 0.0       # cubo: no se mueve en Y
SUBIR_LENTES = 0.094     # carita: sube en Z, ademas de lo que ya baja BAJAR
ATRAS_LENTES = -0.052    # carita: se adelanta en Y (mas cerca de -Y, el frente)

HUESO = "head"

# El hueso 'head' arranca a esta altura y sin girar, asi que pasar del espacio
# de la malla al del hueso -donde el visor coloca las bocas- es solo
#     bone = (x, z - ALTURA_HUESO, -y)
# Lo comprueba comprobar_hueso() en cada pasada, que si cambia el rig salta.
ALTURA_HUESO = 1.05

# Holgura con que la boca se separa del cubo, para que la arista no la parta.
AIRE_BOCA = 0.012

# Lo que la boca queda por debajo de las gafas. La boca NO baja los BAJAR de
# la carita: eso la dejaria en z=1.05, mas abajo de donde tenia el suelo el
# cubo sin girar, y ahi el pico del cubo ya se ha estrechado y la bata la tapa.
# En mover carita.png la sonrisa va pegada debajo de las gafas, asi que se
# cuelga de ellas.
HUECO_BOCA = 0.03

# Holgura al partir por el plano de la cara. Solo tiene que absorber el
# redondeo con que build_bocas.py deja las baldosas nuevas.
HOLGURA = 1e-3


def trozos(ob, idx):
    """Agrupa esos vertices en piezas sueltas, soldando por posicion.

    El GLB trae cada caja con los vertices partidos por cara, asi que la
    conectividad de la malla, por si sola, dejaria cada caja en seis cuadrados
    sueltos. Es la misma union-find que usa build_bocas.py."""
    padre = {v: v for v in idx}

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
    for v in idx:
        k = tuple(round(c, 5) for c in ob.data.vertices[v].co)
        if k in soldado:
            unir(v, soldado[k])
        else:
            soldado[k] = v

    dentro = set(idx)
    for p in ob.data.polygons:
        vs = [v for v in p.vertices if v in dentro]
        for v in vs[1:]:
            unir(vs[0], v)

    grupos = {}
    for v in idx:
        grupos.setdefault(raiz(v), []).append(v)
    return list(grupos.values())


def del_hueso(ob, hueso):
    """Los vertices cuyo peso manda en ese hueso."""
    g = ob.vertex_groups[hueso].index
    fuera = []
    for v in ob.data.vertices:
        if v.groups and max(v.groups, key=lambda x: x.weight).group == g:
            fuera.append(v.index)
    return fuera


def caja(ob, idx):
    co = [ob.data.vertices[i].co for i in idx]
    return (mathutils.Vector((min(c.x for c in co), min(c.y for c in co),
                              min(c.z for c in co))),
            mathutils.Vector((max(c.x for c in co), max(c.y for c in co),
                              max(c.z for c in co))))


def lado(ob, idx):
    lo, hi = caja(ob, idx)
    return max(hi - lo)


def clasificar(ob):
    """Reparte el racimo de la cabeza en cubo, carita y baldosas.

    Se parte por el plano de la cara, no por tamano: al cubo le pertenecen su
    relleno y la cascara del contorno, que el solidify deja como trozo aparte.
    La carita -gafas, ojos, brillos, puente y patillas- esta entera por
    delante del plano. Y las baldosas que puso build_bocas.py son las unicas
    piezas planas: un cuadro sin grosor, justo en el plano."""
    piezas = trozos(ob, del_hueso(ob, HUESO))
    if not piezas:
        raise RuntimeError(f"{ob.name}: no hay nada colgando de '{HUESO}'")

    # el plano de la cara: el frente de la pieza mas grande, la del cubo
    plano = caja(ob, max(piezas, key=lambda p: len(p)))[0].y

    cubo, cara, baldosas = [], [], []
    for pz in piezas:
        lo, hi = caja(ob, pz)
        if hi.y - lo.y < HOLGURA:
            baldosas.append(pz)
        elif hi.y < plano - HOLGURA:
            cara.append(pz)
        else:
            cubo.append(pz)

    def resumen(ps):
        return f"{len(ps)} piezas, {sum(len(p) for p in ps)} verts"

    print(f"     piezas en '{HUESO}': {len(piezas)}  |  plano de la cara y={plano:.4f}")
    print(f"     cubo     : {resumen(cubo)}  -> gira")
    print(f"     carita   : {resumen(cara)}  -> baja {BAJAR}")
    print(f"     baldosas : {resumen(baldosas)}  -> se van")
    if not baldosas:
        print("     (no habia baldosas: build_bocas.py no las puso o ya se quitaron)")
    return ([v for p in cubo for v in p],
            [v for p in cara for v in p],
            [v for p in baldosas for v in p])


def duplicar(ob, arm):
    """Copia la malla con su skin: mismo armature, misma accion, mismos
    materiales. La copia del objeto se lleva los vertex groups y el
    modificador; la de la malla, la geometria."""
    nuevo = ob.copy()
    nuevo.data = ob.data.copy()
    nuevo.name = NUEVO
    nuevo.data.name = NUEVO + "Mesh"
    for c in ob.users_collection:
        c.objects.link(nuevo)
    nuevo.parent = ob.parent
    nuevo.matrix_parent_inverse = ob.matrix_parent_inverse.copy()
    for m in nuevo.modifiers:
        if m.type == "ARMATURE":
            m.object = arm
    return nuevo


def girar(ob, idx, grados):
    """Gira esos vertices sobre el centro de su caja."""
    lo, hi = caja(ob, idx)
    centro = (lo + hi) / 2
    rot = mathutils.Euler([math.radians(a) for a in grados], "XYZ").to_matrix()
    for i in idx:
        v = ob.data.vertices[i]
        v.co = centro + rot @ (v.co - centro)
    ob.data.update()
    return centro


def bajar(ob, idx, cuanto):
    for i in idx:
        ob.data.vertices[i].co.z -= cuanto
    ob.data.update()


def mover(ob, idx, subir, atras):
    for i in idx:
        v = ob.data.vertices[i].co
        v.z += subir
        v.y += atras
    ob.data.update()


def borrar(ob, idx):
    """Quita esos vertices. Va al final: renumera el resto de la malla."""
    if not idx:
        return
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="DESELECT")
    bpy.ops.object.mode_set(mode="OBJECT")
    for i in idx:
        ob.data.vertices[i].select = True
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.delete(type="VERT")
    bpy.ops.object.mode_set(mode="OBJECT")


def comprobar_hueso(arm):
    """El paso al espacio del hueso da por hecho que 'head' arranca en el eje,
    a ALTURA_HUESO y sin girar. Si el rig cambia, mejor saltar aqui que sacar
    una boca descolocada."""
    b = arm.data.bones[HUESO]
    if (abs(b.head_local.x) > 1e-4 or abs(b.head_local.y) > 1e-4
            or abs(b.head_local.z - ALTURA_HUESO) > 1e-4):
        raise RuntimeError(
            f"el hueso '{HUESO}' ya no arranca en (0, 0, {ALTURA_HUESO}) sino en "
            f"{[round(v, 4) for v in b.head_local]}: repasa ALTURA_HUESO")


def sitio_de_la_boca(ob, cubo, cara, alto_boca=0.15):
    """Donde tiene que colgar la boca, en el espacio del hueso 'head'.

    La altura sale de las gafas ya bajadas, no de BAJAR: se cuelga HUECO_BOCA
    por debajo de su borde de abajo, que es como esta dibujada en
    mover carita.png.

    La profundidad hay que buscarla. La boca es plana y el cubo girado ya no
    le ofrece un plano de frente sino una arista: si se deja donde estaba en
    Modelo2 la arista la parte por la mitad. Asi que se mira lo mas adelantado
    que tiene el cubo en la banda que ocupa la boca, y se la pone un pelo por
    delante.

    Devuelve (pos, escala) tal como los quiere BOCA_DE_MODELO en el visor."""
    escala = 0.2474                       # la de Modelo2: misma cara, mismo tamano
    z1 = caja(ob, cara)[0].z - HUECO_BOCA      # el labio de arriba
    z0 = z1 - alto_boca
    delante = [ob.data.vertices[i].co.y for i in cubo
               if abs(ob.data.vertices[i].co.x) < 0.12
               and z0 <= ob.data.vertices[i].co.z <= z1]
    if not delante:
        raise RuntimeError("el cubo no tiene nada a la altura de la boca")
    frente = min(delante)
    print(f"     boca: labio arriba en z={z1:.4f}, cubo delante en y={frente:.4f}")
    return (0.0, round(z1 - ALTURA_HUESO, 4), round(-frente + AIRE_BOCA, 4)), escala


def main():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=ROBOT)

    arm = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    arm.parent = None
    # el importador cuelga todo de un empty de conversion de ejes: sobra
    for o in [o for o in bpy.data.objects if o.type == "EMPTY"]:
        bpy.data.objects.remove(o, do_unlink=True)
    comprobar_hueso(arm)

    viejo = bpy.data.objects.get(NUEVO)
    if viejo:
        print(f"  {NUEVO} ya estaba: se rehace")
        bpy.data.objects.remove(viejo, do_unlink=True)

    base = bpy.data.objects[ORIGEN]
    print(f"  -- {NUEVO} a partir de {ORIGEN} --")
    ob = duplicar(base, arm)

    cubo, cara, baldosas = clasificar(ob)
    centro = girar(ob, cubo, GIRO)
    bajar(ob, cara, BAJAR)
    mover(ob, cubo, SUBIR_CABEZA, ATRAS_CABEZA)
    mover(ob, cara, SUBIR_LENTES, ATRAS_LENTES)
    print(f"     giro {GIRO} sobre ({centro.x:.3f}, {centro.y:.3f}, {centro.z:.3f})")
    print(f"     cubo subido {SUBIR_CABEZA} / corrido {ATRAS_CABEZA}; "
          f"carita subida {SUBIR_LENTES} / corrida {ATRAS_LENTES}")

    pos, escala = sitio_de_la_boca(ob, cubo, cara)
    borrar(ob, baldosas)      # al final: renumera la malla

    mallas = [o for o in bpy.data.objects if o.type == "MESH" and o.parent == arm]
    for o in bpy.data.objects:
        o.select_set(o is arm or o in mallas)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(
        filepath=ROBOT, export_format="GLB", use_selection=True,
        export_apply=False, export_yup=True, export_animations=True,
        export_cameras=False, export_lights=False, export_skins=True,
    )

    print()
    print("=" * 60)
    for o in sorted(mallas, key=lambda x: x.name):
        print(f"  {o.name:16} : {len(o.data.polygons)} caras, "
              f"{len(o.data.materials)} materiales")
    accion = arm.animation_data.action if arm.animation_data else None
    print(f"  accion           : {accion.name if accion else 'NINGUNA'}")
    print("  para BOCA_DE_MODELO en index.html y charla.html:")
    print(f"    {NUEVO}: {{ pos: [{pos[0]}, {pos[1]}, {pos[2]}], escala: {escala} }},")
    print(f"  -> {ROBOT}  ({os.path.getsize(ROBOT) / 1024:.0f} KB)")
    print("=" * 60)


main()

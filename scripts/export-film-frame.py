# Exports one film frame from Frame_1.blend to a web file. The .blend is only read, never saved.
# Usage: blender -b <copy of Frame_1.blend> --python scripts/export-film-frame.py -- public/models/film/film-frame.glb
#
# Blender has the film facing +X, running along Y, with Z up. The web file has it facing +Z, running along +X, with Y up.
# Object positions, turns and sizes are baked into the points, so every node sits at zero.
# Nodes: Frame (the film with its window and sprocket holes), Image (picture), Content (text strip),
# UpperFill and LowerFill (the surfaces seen through the holes).
# UVs are made from position, so they stay upright on screen:
#   Image and Content: 0..1 covers exactly the part seen through the window.
#   Frame: 0..1 across the whole 2 x 2 frame.
#   UpperFill / LowerFill: 0..1 along the frame, 0..1 across the strip of holes.
import bpy, json, os, sys
from mathutils import Matrix

OUT = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
# Saved names first, then the names the file is given once the user's renames are saved.
SOURCES = {
    "Frame": ["Cube", "Frame"],
    "Image": ["Plane.003", "Image"],
    "Content": ["Plane.002", "Content"],
    "UpperFill": ["Plane", "Upper Fill"],
    "LowerFill": ["Plane.001", "Lower fill", "Lower Fill"],
}
TURN = Matrix(((0, 1, 0, 0), (-1, 0, 0, 0), (0, 0, 1, 0), (0, 0, 0, 1)))  # (x, y, z) -> (y, -x, z)


def find(names):
    for name in names:
        if name in bpy.data.objects:
            return bpy.data.objects[name]
    raise SystemExit(f"missing object, tried {names}")


def bounds(mesh):
    xs, ys, zs = zip(*(v.co for v in mesh.vertices))
    return (min(xs), max(xs)), (min(ys), max(ys)), (min(zs), max(zs))


def baked(node, source):
    mesh = source.data.copy()
    mesh.name = node
    matrix = TURN @ source.matrix_world
    mesh.transform(matrix)
    if matrix.determinant() < 0:
        mesh.flip_normals()
    return mesh


frame_mesh = baked("Frame", find(SOURCES["Frame"]))
meshes = {"Frame": frame_mesh}
for node in ("Image", "Content", "UpperFill", "LowerFill"):
    meshes[node] = baked(node, find(SOURCES[node]))

# After TURN: X runs along the film, Z is up, and the front faces -Y.
(fx0, fx1), _, (fz0, fz1) = bounds(frame_mesh)
image_b, content_b = bounds(meshes["Image"]), bounds(meshes["Content"])
# The window is cut by the frame points that lie inside the picture and text strip; the sprocket holes lie outside them.
inside = [v.co for v in frame_mesh.vertices if content_b[2][0] < v.co.z < image_b[2][1]]
win_x0, win_x1 = min(c.x for c in inside), max(c.x for c in inside)
win_z0, win_z1 = min(c.z for c in inside), max(c.z for c in inside)
split = (image_b[2][0] + content_b[2][1]) / 2  # where the picture meets the text strip

rects = {
    "Frame": (fx0, fx1, fz0, fz1),
    "Image": (win_x0, win_x1, split, win_z1),
    "Content": (win_x0, win_x1, win_z0, split),
}
for node in ("UpperFill", "LowerFill"):
    (_, _), _, (z0, z1) = bounds(meshes[node])
    rects[node] = (fx0, fx1, z0, z1)

for node, mesh in meshes.items():
    x0, x1, z0, z1 = rects[node]
    layer = mesh.uv_layers.active or mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        co = mesh.vertices[loop.vertex_index].co
        layer.data[loop.index].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
    for extra in [l for l in mesh.uv_layers if l != layer]:
        mesh.uv_layers.remove(extra)
    mesh.materials.clear()

scene = bpy.data.scenes.new("FilmExport")
bpy.context.window.scene = scene
for node, mesh in meshes.items():
    obj = bpy.data.objects.new(node, mesh)
    scene.collection.objects.link(obj)
    obj.select_set(True)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format="GLB", use_selection=True, export_yup=True, export_apply=False,
    export_materials="NONE", export_normals=True, export_texcoords=True, export_tangents=False,
    export_animations=False, export_cameras=False, export_lights=False, export_extras=False,
)
report = {
    "frame": {"width": fx1 - fx0, "height": fz1 - fz0, "thickness": bounds(frame_mesh)[1][1] - bounds(frame_mesh)[1][0]},
    "window": {"x": [win_x0, win_x1], "y": [win_z0, win_z1], "split": split},
    "image": {"width": win_x1 - win_x0, "height": win_z1 - split},
    "content": {"width": win_x1 - win_x0, "height": split - win_z0},
    "fills": {n: rects[n][2:] for n in ("UpperFill", "LowerFill")},
    "bytes": os.path.getsize(OUT),
}
print("FILM_EXPORT " + json.dumps(report))

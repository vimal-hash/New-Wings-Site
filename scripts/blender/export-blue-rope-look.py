"""Export the blue source's material lookup, never geometry or a saved .blend.

The approved web geometry already stores red emission colour per thread point.
Both source colour ramps use the same hue coordinate. A small lookup maps that
stored ramp back to hue, then evaluates the actual blue Blender ramp. Grain,
emission strength, positions and the existing model downloads remain shared.
Usage: blender -b --python this.py -- <project root> <evidence directory>
"""
import bpy, json, os, struct, sys, zlib
import numpy as np

ROOT, EVIDENCE = sys.argv[sys.argv.index("--") + 1:][:2]
SOURCE = "D:/CodexOutputs/Loki_Rope_20261103/r3f/Rope_DarkBlue_r3f.blend"
SOURCE_LOOK = "D:/CodexOutputs/Loki_Rope_20261103/r3f/Rope_DarkBlue_r3f_look.json"
RED_LOOK = "D:/CodexOutputs/Loki_Rope_20261103/r3f/Rope_Red_r3f_look.json"
os.makedirs(EVIDENCE, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=SOURCE)
scene = bpy.data.scenes["Rope_Macro"]
bpy.context.window.scene = scene
nodes = bpy.data.materials["Rope_Fibre"].node_tree.nodes
blue = json.load(open(SOURCE_LOOK))
red = json.load(open(RED_LOOK))
elements = nodes["Color Ramp.003"].color_ramp.elements
positions = np.array([e.position for e in elements])
colours = np.array([e.color[:3] for e in elements])
assert np.max(np.abs(colours - np.array(blue["fibre"]["hue_ramp"][1]))) < 1e-6
red_colours = np.array(red["fibre"]["hue_ramp"][1])
assert np.all(np.diff(red_colours[:, 0]) > 0), "Inverse palette must be monotonic"

def png(path, values):
    # Explicit sRGB bytes; runtime performs the one sRGB-to-linear decode.
    values = np.clip(values, 0, 1)
    values = np.where(values <= .0031308, values * 12.92, 1.055 * values ** (1 / 2.4) - .055)
    pixels = np.round(values * 255).astype(np.uint8).tobytes()
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", len(values), 1, 8, 2, 0, 0, 0))
                + chunk(b"IDAT", zlib.compress(b"\0" + pixels, 9)) + chunk(b"IEND", b""))

out = os.path.join(ROOT, "public/rope-model/blue")
os.makedirs(out, exist_ok=True)
files = {}
for name, size in (("palette-desktop.png", 1024), ("palette-laptop.png", 256)):
    r = np.linspace(0, 1, size)
    hue = np.interp(r, red_colours[:, 0], np.array(red["fibre"]["hue_ramp"][0]))
    values = np.stack([np.interp(hue, positions, colours[:, i]) for i in range(3)], 1)
    png(os.path.join(out, name), values)
    files[name] = {"width": size, "height": 1, "bytes": os.path.getsize(os.path.join(out, name))}

def rgb(socket):
    return list(socket.default_value[:3])

core = bpy.data.materials["Rope_Core"].node_tree.nodes
manifest = {
    "source": SOURCE, "method": "Blender emission-palette lookup, no bloom, no geometry export",
    "side": rgb(nodes["Mix.004"].inputs[7]), "face": rgb(nodes["Mix.005"].inputs[7]),
    "core": rgb(core["Diffuse BSDF"].inputs["Color"]),
    "transparent": rgb(next(n for n in nodes if n.type == "BSDF_TRANSPARENT").inputs["Color"]),
    "exposure": scene.cycles.film_exposure,
    "grade": [list(map(list, zip(*channel))) for channel in blue["grade"]["curves_on_linear_rgb"]],
    "redHue": red["fibre"]["hue_ramp"], "blueHue": [positions.tolist(), colours.tolist()],
    "files": files,
}
json.dump(manifest, open(os.path.join(ROOT, "components/rope-model/blue-look.json"), "w"), indent=2)
inventory = {"manifest": manifest, "lights": [{"name": o.name, "colour": list(o.data.color), "energy": o.data.energy} for o in scene.objects if o.type == "LIGHT"],
             "compositor": [{"name": n.name, "type": n.type} for n in scene.compositing_node_group.nodes]}
json.dump(inventory, open(os.path.join(EVIDENCE, "blender-source-inventory.json"), "w"), indent=2)
print("BLUE_LOOK_EXPORTED", json.dumps(files), flush=True)

# Matched 1920x1080 reference at the new single-tunnel mid stop, Blender Y=12 / web Z=-12.
scene.camera.location.y = 12
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1920, 1080, 100
scene.camera.data.sensor_fit = "HORIZONTAL"
scene.cycles.samples = 64
scene.cycles.use_denoising = True
scene.render.image_settings.file_format = "OPEN_EXR"
scene.render.image_settings.color_depth = "32"
scene.render.filepath = os.path.join(EVIDENCE, "blender-blue-stop-linear.exr")
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "OPTIX"
    prefs.get_devices()
    for device in prefs.devices:
        device.use = device.type == "OPTIX"
    scene.cycles.device = "GPU"
except Exception:
    scene.cycles.device = "CPU"
bpy.ops.render.render(write_still=True)
image = bpy.data.images.load(scene.render.filepath)
rgba = np.empty(1920 * 1080 * 4, np.float32)
image.pixels.foreach_get(rgba)
raw = rgba.reshape(1080, 1920, 4)[::-1, :, :3]
graded = np.stack([np.interp(raw[..., i], *channel) for i, channel in enumerate(blue["grade"]["curves_on_linear_rgb"])], 2)
values = np.clip(graded, 0, 1)
values = np.where(values <= .0031308, values * 12.92, 1.055 * values ** (1 / 2.4) - .055)
pixels = np.round(values * 255).astype(np.uint8)
def chunk(kind, data):
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
with open(os.path.join(EVIDENCE, "blender-blue-stop.png"), "wb") as f:
    f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", 1920, 1080, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(b"".join(b"\0" + row.tobytes() for row in pixels), 6)) + chunk(b"IEND", b""))
print("BLUE_REFERENCE_COMPLETE", flush=True)

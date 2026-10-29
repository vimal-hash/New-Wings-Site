"""Run using Blender --background <final.blend> --python <this file>.

Rebuild the browser's camera samples after editing the two corridor walls.
This reads the loaded scene and writes JSON; it never saves the Blender file.
"""
import json
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
matrix = (
    bpy.data.objects['CORRIDOR | Blue centre placement'].matrix_world
    @ bpy.data.objects['LOGO • Move Rotate Scale • 01'].matrix_world
)


def boundary(name):
    obj = bpy.data.objects[name]
    transform = matrix.inverted() @ obj.matrix_world
    vertices = [transform @ vertex.co for vertex in obj.data.vertices]
    floor = min(p.z for p in vertices)
    indices = {i for i, p in enumerate(vertices) if p.z < floor + 0.00001}
    adjacent = {i: [] for i in indices}
    for edge in obj.data.edges:
        a, b = edge.vertices
        if a in indices and b in indices:
            adjacent[a].append(b)
            adjacent[b].append(a)
    ends = [i for i in indices if len(adjacent[i]) == 1]
    assert len(ends) == 2, 'Wall must have one continuous bottom edge.'
    index = max(ends, key=lambda i: vertices[i].x)
    previous, points = None, []
    while True:
        points.append(vertices[index])
        following = [i for i in adjacent[index] if i != previous]
        if not following:
            return points
        previous, index = index, following[0]


def sample(points, progress):
    lengths = [(b - a).length for a, b in zip(points, points[1:])]
    remaining = progress * sum(lengths)
    for i, length in enumerate(lengths):
        if remaining <= length:
            return points[i].lerp(points[i + 1], remaining / length)
        remaining -= length
    return points[-1].copy()


left = boundary('Red corridor wall • separate from logo')
right = boundary('Connecting plane • joins yellow tip')


def centre(progress):
    return (sample(left, progress) + sample(right, progress)) / 2


def web(point):
    # Blender Z-up to the glTF Y-up coordinate system.
    return [round(point.x, 8), round(point.z, 8), round(-point.y, 8)]


samples, clearance = [], float('inf')
for i in range(241):
    progress = 0.035 + (0.94 - 0.035) * i / 240
    position, target = centre(progress), centre(max(0, progress - 0.10))
    position.z = target.z = 0.06
    if progress < 0.10:
        target += (centre(0) - centre(0.01)).normalized() * ((0.10 - progress) * 4)
    for edge in [left, right]:
        for a, b in zip(edge, edge[1:]):
            direction, distance = b - a, position - a
            direction.z = distance.z = 0
            fraction = max(0, min(1, distance.dot(direction) / direction.length_squared))
            clearance = min(clearance, (distance - direction * fraction).length)
    samples.append({'position': web(matrix @ position), 'target': web(matrix @ target)})

assert clearance > 0.10, 'Camera path is too close to a wall; review before exporting.'
output = {
    'up': web((matrix.to_3x3() @ Vector((0, 0, 1))).normalized()),
    'samples': samples,
    'modelBytes': 645252, 'modelTriangles': 49360, 'modelObjects': 56,
    'minCameraWallClearanceLocal': clearance,
    'note': 'Camera samples generated from final wall centre; glTF Y-up coordinates. Same .06 local eye height throughout.',
}
(ROOT / 'components/corridor/route.json').write_text(json.dumps(output, separators=(',', ':')))
print(f'Exported 241 camera samples; minimum wall clearance: {clearance:.6f} local units.')

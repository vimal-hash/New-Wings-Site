import bpy,json,math
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from pathlib import Path
P=Path('docs/corridor-wall-red-refinement');pose=json.loads((P/'page-pose.json').read_text());eye=Vector(pose['eye']);f=(Vector(pose['target'])-eye).normalized();right=f.cross(Vector((0,0,1))).normalized();up=right.cross(f).normalized();obs=json.loads(Path('D:/CodexOutputs/Corridor_Bake_Preparation_20261024/runtime-meshes.json').read_text());trees=[]
for o in obs:
 if not ('corridor wall' in o['material'] or 'Connecting plane' in o['material']):continue
 trees.append((o['material'],BVHTree.FromPolygons(o['positions'],[o['indices'][i:i+3] for i in range(0,len(o['indices']),3)],all_triangles=True)))
for x in [-.8,-.5,.5,.8]:
 ray=(f+right*x*math.tan(math.radians(20))*pose['width']/pose['height']).normalized();hits=[(name,tree.ray_cast(eye,ray)[3]) for name,tree in trees];print('SCREEN_X',x,sorted([(n,d) for n,d in hits if d is not None],key=lambda h:h[1])[:1])

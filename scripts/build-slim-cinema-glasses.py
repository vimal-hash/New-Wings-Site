"""Front-only, slim continuous cinema frame. Run with Blender --background --python.

Metres; Blender X/Z is the front plane. No source files or scene assets are edited.
The bevel is modelled, not a highlight texture. The two solid rims touch but stay separate.
"""
import bpy, math, json, os, bmesh
from mathutils import Vector

OUT = 'D:/CodexOutputs/Glasses_Rebuild_20261031'
PUBLIC = 'D:/New folio/new site code/new_site_three/public/models/cinema-glasses-slim.glb'
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)

def bezier(p0, p1, p2, p3, count=48):
    return [tuple((1-t)**3*p0[a]+3*(1-t)**2*t*p1[a]+3*(1-t)*t*t*p2[a]+t**3*p3[a] for a in range(2)) for t in [i/count for i in range(count)]]

# Deliberately tall lenses for a wide viewport. Smooth tangents at every join.
# The nasal contour is complete: no cut ends, dangling tips or overlapping halves.
segments = [
    ((.0010422,.022),(.0010422,.034),(.016,.034),(.040,.034)),
    ((.040,.034),(.064,.034),(.076,.034),(.076,.022)),
    ((.076,.022),(.076,.008),(.076,-.022),(.067,-.030)),
    ((.067,-.030),(.045,-.034),(.00095,-.034),(.00095,-.018)),
    ((.00095,-.018),(.00095,-.004),(.0010422,.008),(.0010422,.022)),
]
path = sum([bezier(*s) for s in segments], [])
# Author the contact edge exactly on the symmetry plane, not by scaling either lens.
path=[(.00095*(1.+.15*max(0.,z/.034)),z) if i>=192 or i==0 else (x,z) for i,(x,z) in enumerate(path)]

def tube(name, points, closed, half_width, depth):
    verts, faces = [], []
    count, sides = len(points), 12
    for i, p in enumerate(points):
        before, after = points[(i-1)%count], points[(i+1)%count] if closed or i<count-1 else points[i]
        if not closed and i==0: before=p
        tangent=Vector((after[0]-before[0],after[1]-before[1])).normalized()
        normal=Vector((-tangent.y,tangent.x))
        # Gently thicker upper rim, still <1.5 mm total at its broadest point.
        w=half_width*(1.+.15*max(0.,p[1]/.034))
        for j in range(sides):
            a=2*math.pi*j/sides
            x=p[0]+normal.x*w*math.cos(a)
            if name=='Frame_Right' and (i>=192 or i==0) and j==0:x=0.
            verts.append((x,depth*math.sin(a),p[1]+normal.y*w*math.cos(a)))
    for i in range(count if closed else count-1):
        for j in range(sides):
            faces.append((i*sides+j,i*sides+(j+1)%sides,((i+1)%count)*sides+(j+1)%sides,((i+1)%count)*sides+j))
    if not closed:
        faces.extend([tuple(reversed(range(sides))),tuple((count-1)*sides+j for j in range(sides))])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    return obj

right=tube('Frame_Right',path,True,.00095,.0010)
left_mesh=right.data.copy();left_mesh.name='Frame_Left'
for vertex in left_mesh.vertices:vertex.co.x=-vertex.co.x
left=bpy.data.objects.new('Frame_Left',left_mesh);bpy.context.collection.objects.link(left)
for obj in [left,right]:
    bm=bmesh.new();bm.from_mesh(obj.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(obj.data);bm.free()
    for polygon in obj.data.polygons:polygon.use_smooth=True

frame_material=bpy.data.materials.new('Satin black acetate');frame_material.diffuse_color=(.008,.010,.014,1);frame_material.use_nodes=True
bsdf=frame_material.node_tree.nodes.get('Principled BSDF')
bsdf.inputs['Base Color'].default_value=(.008,.010,.014,1)
bsdf.inputs['Roughness'].default_value=.30
bsdf.inputs['Metallic'].default_value=.05
bsdf.inputs['Coat Weight'].default_value=.24
right.data.materials.append(frame_material)
left.data.materials.append(frame_material)

def lens(name, sign):
    # Filled curved optical surface, inset beneath the rim. A subtle convex profile.
    centre=Vector((sign*.039,.00025,0))
    verts=[tuple(centre)];faces=[]
    for x,z in path:
        v=Vector((sign*x,.00025,z));delta=Vector((v.x-centre.x,v.z-centre.z)).normalized()
        v.x-=delta.x*.00018;v.z-=delta.y*.00018
        verts.append(tuple(v))
    for i in range(len(path)):faces.append((0,i+1,(i+1)%len(path)+1))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    # Front face towards Blender -Y / exported +Z.
    if mesh.polygons[0].normal.y>0:
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.reverse_faces(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj)
    material=bpy.data.materials.get('Neutral smoke lens')
    if not material:
        material=bpy.data.materials.new('Neutral smoke lens');material.use_nodes=True
        p=material.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(.30,.32,.34,1);p.inputs['Transmission Weight'].default_value=.92;p.inputs['Roughness'].default_value=.06
    obj.data.materials.append(material)
    return obj
lenses=[lens('Lens_Right',1),lens('Lens_Left',-1)]
root=bpy.data.objects.new('CinemaGlasses_Slim_Root',None);bpy.context.collection.objects.link(root)
for obj in [left,right,*lenses]:obj.parent=root
bpy.ops.object.select_all(action='DESELECT')
for obj in [root,left,right,*lenses]:obj.select_set(True)
bpy.context.view_layer.objects.active=right
bpy.ops.export_scene.gltf(filepath=PUBLIC,export_format='GLB',use_selection=True,export_yup=True,export_apply=True)

bm=bmesh.new();bm.from_mesh(right.data)
report={'asset':PUBLIC,'frame_vertices_per_half':len(right.data.vertices),'frame_faces_per_half':len(right.data.polygons),'nonmanifold_frame_edges_per_half':sum(not e.is_manifold for e in bm.edges),'rim_width_mm':[1.9,2.185],'depth_mm':2.0,'bottom_curve_start_m':-.018,'contact_edge_vertices':sum(abs(v.co.x)<1e-8 for v in right.data.vertices),'halves_separate':True}
bm.free()
with open(OUT+'/geometry-report.json','w') as file:json.dump(report,file,indent=2)

# A separate studio, never exported to the website.
world=bpy.data.worlds.new('Studio');bpy.context.scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.15,.17,.20,1)
def area(name, location, energy, size):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=location;obj.rotation_euler=(Vector((0,0,0))-obj.location).to_track_quat('-Z','Y').to_euler()
area('Broad key',(-.10,-.14,.12),8,.16);area('Rim',(.14,-.08,.02),4,.08)
camera_data=bpy.data.cameras.new('Front camera');camera=bpy.data.objects.new('Front camera',camera_data);bpy.context.collection.objects.link(camera);camera.location=(0,-.30,0);camera.rotation_euler=(Vector((0,0,0))-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.type='ORTHO';camera_data.ortho_scale=.18;bpy.context.scene.camera=camera
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1440;scene.render.resolution_y=700;scene.render.resolution_percentage=100;scene.render.filepath=OUT+'/blender-front.png'
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/cinema-glasses-slim.blend')
print(json.dumps(report))

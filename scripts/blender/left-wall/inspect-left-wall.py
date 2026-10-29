"""Read-only inspection of the disposable copy: identify the left wall and its shading context."""
import bpy, json, mathutils, sys
OUT=r"D:\New folio\new site code\new_site_three\docs\left-wall-audit\inspection.json"
s=bpy.context.scene;dg=bpy.context.evaluated_depsgraph_get()
def bounds(o):
    bb=[o.matrix_world@mathutils.Vector(c) for c in o.bound_box]
    return [[min(v[i] for v in bb) for i in range(3)],[max(v[i] for v in bb) for i in range(3)]]
cands=[]
for o in s.objects:
    if o.type!='MESH':continue
    mn,mx=bounds(o)
    # web X 8.21-8.51 -> blender X 8.20-8.50 ; web z 5.2-26 -> blender y 0-20.8
    if mn[0]>7.5 and mx[0]<9 and (mx[1]-mn[1])>5:
        cands.append({'name':o.name,'min':[round(x,4) for x in mn],'max':[round(x,4) for x in mx],'data':o.data.name,'users':o.data.users,
          'collections':[c.name for c in o.users_collection],'mats':[sl.material.name if sl.material else None for sl in o.material_slots],
          'mods':[(m.type,m.name,m.show_render) for m in o.modifiers],'uv':[(u.name,u.active_render) for u in o.data.uv_layers],
          'polys':len(o.data.polygons),'hide_render':o.hide_render,'visible_camera':o.visible_camera,'is_shadow_catcher':o.is_shadow_catcher,
          'light_linking':{'rx':getattr(o.light_linking,'receiver_collection',None) and o.light_linking.receiver_collection.name,'bx':getattr(o.light_linking,'blocker_collection',None) and o.light_linking.blocker_collection.name}})
def graph(m):
    if not m or not m.use_nodes:return None
    nodes=[]
    for n in m.node_tree.nodes:
        d={'n':n.name,'t':n.bl_idname}
        if n.bl_idname=='ShaderNodeTexImage' and n.image:d['img']=[n.image.name,n.image.filepath,list(n.image.size),n.image.colorspace_settings.name]
        if hasattr(n,'uv_map'):d['uv_map']=n.uv_map
        ins={}
        for i in n.inputs:
            if i.is_linked:ins[i.name]='<-'+i.links[0].from_node.name+'.'+i.links[0].from_socket.name
            elif hasattr(i,'default_value'):
                try:v=i.default_value;ins[i.name]=[round(x,4) for x in v] if hasattr(v,'__len__') else (round(v,4) if isinstance(v,float) else v)
                except Exception:pass
        d['in']={k:v for k,v in ins.items() if isinstance(v,str) or k in('Base Color','Roughness','Metallic','Scale','Strength','Coat Weight','Sheen Weight','Specular IOR Level','Color','Fac','Distance','Detail')}
        nodes.append(d)
    return nodes
mats={}
for c in cands:
    for mn in c['mats']:
        if mn and mn not in mats:mats[mn]=graph(bpy.data.materials[mn])
v=s.view_settings
info={'render':{'engine':s.render.engine,'view':v.view_transform,'look':v.look,'exposure':v.exposure,'gamma':v.gamma,'display':s.display_settings.display_device,'curve':v.use_curve_mapping,
  'samples':s.cycles.samples,'res':[s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage],'camera':s.camera and s.camera.name,
  'world':s.world and s.world.name,'film_transparent':s.render.film_transparent,'light_tree':s.cycles.use_light_tree,'max_bounces':s.cycles.max_bounces,'clamp_ind':s.cycles.sample_clamp_indirect},
  'candidates':cands,'materials':mats}
json.dump(info,open(OUT,'w'),indent=1);print('INSPECT_DONE',len(cands))

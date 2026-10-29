import bpy,json,os
paths=['D:/CodexOutputs/CollectionTransfer_20261016/Theatre_Moon_Projector_restored_one.blend','D:/CodexOutputs/Theatre_Optimization_20261017/Theatre_Moon_Projector_optimized.blend']
rows=[]
for p in paths:
 bpy.ops.wm.open_mainfile(filepath=p,load_ui=False)
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];dg=bpy.context.evaluated_depsgraph_get();tris=0
 objects={}
 for o in meshes:
  ev=o.evaluated_get(dg);m=ev.to_mesh();m.calc_loop_triangles();n=len(m.loop_triangles);tris+=n;ev.to_mesh_clear()
  objects[o.name]={'baseVertices':len(o.data.vertices),'triangles':n,'materials':[m.name if m else None for m in o.data.materials],'modifiers':[(m.type,m.show_render) for m in o.modifiers]}
 s=bpy.context.scene
 rows.append({'file':p,'bytes':os.path.getsize(p),'objects':len(s.objects),'meshes':len(meshes),'evaluatedTriangles':tris,'lights':len([o for o in s.objects if o.type=='LIGHT']),'materials':len(bpy.data.materials),'viewTransform':s.view_settings.view_transform,'exposure':s.view_settings.exposure,'objectDetails':objects})
a,b=rows;namesA=set(a['objectDetails']);namesB=set(b['objectDetails']);changed=[{'name':k,'original':a['objectDetails'][k],'optimized':b['objectDetails'][k]} for k in sorted(namesA&namesB) if a['objectDetails'][k]!=b['objectDetails'][k]]
print('COMPARISON',json.dumps({'files':[{k:v for k,v in r.items() if k!='objectDetails'} for r in rows],'added':sorted(namesB-namesA),'removed':sorted(namesA-namesB),'changedMeshes':changed}),flush=True)

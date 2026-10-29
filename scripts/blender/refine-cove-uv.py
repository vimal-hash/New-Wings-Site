"""Cove-only UV investigation in a disposable background scene; source never saved."""
import bpy,bmesh,numpy as np,json
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
bpy.ops.wm.open_mainfile(filepath=str(P/'Ceiling_PBR_prepared.blend'),load_ui=False)
obj=bpy.data.objects['Ceiling PBR | HALO II | Continuous rolled plaster cove']
m=obj.data;m.calc_loop_triangles();layer=m.uv_layers['CeilingLightmap'];old=np.array([v.uv[:] for v in layer.data])
edges={};parent=list(range(len(m.polygons)))
def root(i):
 while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
 return i
for p in m.polygons:
 ls=list(p.loop_indices)
 for a,b in zip(ls,ls[1:]+ls[:1]):
  va,vb=m.loops[a].vertex_index,m.loops[b].vertex_index
  key=tuple(sorted((va,vb)));uv=(old[a],old[b]) if va<vb else (old[b],old[a])
  edges.setdefault(key,[]).append((p.index,uv))
for e in m.edges:
 pair=edges.get(tuple(sorted(e.vertices)),[])
 joined=len(pair)==2 and np.max(np.abs(np.array(pair[0][1])-np.array(pair[1][1])))<1e-6
 e.use_seam=not joined
 if joined:parent[root(pair[0][0])]=root(pair[1][0])
islands={}
for p in m.polygons:islands.setdefault(root(p.index),[]).extend(p.loop_indices)
def stats(uv,selection=None):
 vals=[]
 for t in m.loop_triangles:
  if selection is not None and t.loops[0] not in selection:continue
  p=np.array([(obj.matrix_world@m.vertices[i].co)[:] for i in t.vertices]);q=uv[list(t.loops)];e,f=p[1]-p[0],p[2]-p[0];length=np.linalg.norm(e);x=np.dot(f,e)/length;y=np.sqrt(max(0,np.dot(f,f)-x*x))
  if y<1e-10:continue
  J=np.column_stack(((q[1]-q[0])/length,(q[2]-q[0]-(q[1]-q[0])*x/length)/y));s=np.linalg.svd(J,compute_uv=False);vals.append((float(s[0]/s[1]),length*y/2,t.polygon_index))
 return {'max':max(v[0] for v in vals),'areaOver5Percent':sum(v[1] for v in vals if v[0]>1.05),'area':sum(v[1] for v in vals),'badPolygons':sorted(set(v[2] for v in vals if v[0]>1.05))}
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.unwrap(method='ANGLE_BASED',margin=0,iterations=30)
bpy.ops.object.mode_set(mode='OBJECT')
new=np.array([v.uv[:] for v in m.uv_layers['CeilingLightmap'].data])
print('UV_ACTIVE',m.uv_layers.active.name,'RAW',stats(new),flush=True)
# Preserve each original island's reserved rectangle with a uniform similarity.
for loops in islands.values():
 a=old[loops];b=new[loops];u,_,vh=np.linalg.svd((b-b.mean(0)).T@(a-a.mean(0)));b=(b-b.mean(0))@(u@vh)
 alo,ahi=a.min(0),a.max(0);blo,bhi=b.min(0),b.max(0)
 scale=min((ahi-alo)/np.maximum(bhi-blo,1e-10))*.98
 new[loops]=(b-(blo+bhi)/2)*scale+(alo+ahi)/2
for number,loops in enumerate(islands.values()):
 before,after=stats(old,set(loops)),stats(new,set(loops))
 print('ISLAND',number,json.dumps({'before':before,'after':after}),flush=True)
 if after['max']>before['max'] and number!=0:new[loops]=old[loops]
# Four tiny corner cap polygons need their own cuts. Give them isotropic
# planar charts in unused atlas space, keeping all other objects' UVs intact.
bad=stats(new)['badPolygons'];N=2048;occupied=np.zeros((N,N),bool)
for other in bpy.context.scene.objects:
 if not other.name.startswith('Ceiling PBR | '):continue
 other.data.calc_loop_triangles()
 coords=new if other==obj else np.array([v.uv[:] for v in other.data.uv_layers['CeilingLightmap'].data])
 for t in other.data.loop_triangles:
  if other==obj and t.polygon_index in bad:continue
  points=coords[list(t.loops)]*N;lo=np.maximum(np.floor(points.min(0)).astype(int)-8,0);hi=np.minimum(np.ceil(points.max(0)).astype(int)+9,N)
  occupied[lo[1]:hi[1],lo[0]:hi[0]]=True
for index in bad:
 p=m.polygons[index];loops=list(p.loop_indices);points=np.array([(obj.matrix_world@m.vertices[m.loops[i].vertex_index].co)[:] for i in loops]);_,_,vh=np.linalg.svd(points-points.mean(0),full_matrices=False)
 flat=(points-points.mean(0))@vh[:2].T;flat-=flat.min(0);pixels=flat*52
 width,height=np.ceil(pixels.max(0)).astype(int)+18;found=False
 for y in range(12,N-height-12,4):
  for x in range(12,N-width-12,4):
   if not occupied[y:y+height,x:x+width].any():
    new[loops]=(pixels+[x+9,y+9])/N;occupied[y:y+height,x:x+width]=True;found=True;break
  if found:break
 assert found,'No isolated corner chart space'
print('ISOLATED_CAPS',bad,flush=True)
print('COVE_UV_REFINEMENT',json.dumps({'islands':len(islands),'before':stats(old),'after':stats(new)}),flush=True)
out={'object':obj.name,'old':old.tolist(),'new':new.tolist(),'vertices':[(obj.matrix_world@v.co)[:] for v in m.vertices],'triangles':[{'vertices':list(t.vertices),'loops':list(t.loops),'normals':[m.corner_normals[i].vector[:] for i in t.loops]} for t in m.loop_triangles]}
(P/'cove-uv-refinement.json').write_text(json.dumps(out))




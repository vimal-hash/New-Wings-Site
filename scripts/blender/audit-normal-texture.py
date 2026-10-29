import bpy,numpy as np
import OpenImageIO as o
from pathlib import Path
p=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
for name in ['normal.png','normal-clean.png']:
 a=o.ImageBuf(str(p/name)).get_pixels(o.FLOAT)[...,:3];valid=np.any(a>.01,axis=-1);a=a[valid];print(name,'range',a.min(0),a.max(0),'median',np.median(a,0),'belowBlue08',float((a[:,2]<.8).mean()),flush=True)

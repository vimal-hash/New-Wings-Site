"""Remove UV-bake mottling from smooth plaster illumination, not material detail."""
import bpy,numpy as np,json
import OpenImageIO as oiio
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
report={}
for label,width in [('irradiance',41),('specular',11)]:
    source=oiio.ImageBuf(str(P/(label+'-flat-clean.exr')))
    kernel=oiio.ImageBufAlgo.make_kernel('gaussian',width,width)
    result=oiio.ImageBufAlgo.convolve(source,kernel)
    pixels=np.ascontiguousarray(np.maximum(result.get_pixels(oiio.FLOAT)[...,:3],0))
    h,w=pixels.shape[:2]
    spec=oiio.ImageSpec(w,h,3,oiio.HALF);spec.attribute('compression','zip')
    output=oiio.ImageBuf(spec);output.set_pixels(oiio.ROI(0,w,0,h,0,1,0,3),pixels);output.write(str(P/(label+'-polished.exr')))
    report[label]={'size':[w,h],'filter':'gaussian','kernelWidth':width,'scope':'smooth illumination/reflection field only; normal map unchanged'}
(P/'polish-report.json').write_text(json.dumps(report,indent=2));print('CEILING_LIGHTING_POLISHED',json.dumps(report),flush=True)


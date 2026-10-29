"""Offline denoising of illumination only; no blur added to the PBR normal map."""
import bpy, ctypes as C, os, numpy as np, json, sys
import OpenImageIO as oiio
from pathlib import Path
P=Path('D:/CodexOutputs/Theatre_Ceiling_PBR_20261023')
lib=Path(bpy.app.binary_path).parent/'blender.shared';dll_path=os.add_dll_directory(str(lib));oidn=C.CDLL(str(lib/'OpenImageDenoise.dll'))
def api(name,result,args):
    f=getattr(oidn,name);f.restype=result;f.argtypes=args;return f
ptr=C.c_void_p;string=C.c_char_p;size=C.c_size_t
device_new=api('oidnNewDevice',ptr,[C.c_int]);device_commit=api('oidnCommitDevice',None,[ptr]);device_release=api('oidnReleaseDevice',None,[ptr])
filter_new=api('oidnNewFilter',ptr,[ptr,string]);filter_image=api('oidnSetSharedFilterImage',None,[ptr,string,ptr,C.c_int,size,size,size,size,size]);filter_bool=api('oidnSetFilterBool',None,[ptr,string,C.c_bool]);filter_commit=api('oidnCommitFilter',None,[ptr]);filter_execute=api('oidnExecuteFilter',None,[ptr]);filter_release=api('oidnReleaseFilter',None,[ptr]);get_error=api('oidnGetDeviceError',C.c_int,[ptr,C.POINTER(string)])
device=device_new(1);device_commit(device)
def check():
    message=string();error=get_error(device,C.byref(message))
    if error:raise RuntimeError(message.value.decode() if message.value else str(error))
label='specular' if '--specular' in sys.argv else 'irradiance'
label=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--label=')),label)
buf=oiio.ImageBuf(str(P/(label+'.exr')))
# Reject isolated path-tracing fireflies before they become denoised blotches.
# Only the smooth illumination/reflection fields are filtered; never albedo or
# geometric detail. A 3px atlas footprint preserves the broad cove gradients.
buf=oiio.ImageBufAlgo.median_filter(buf,3,3)
color=np.ascontiguousarray(buf.get_pixels(oiio.FLOAT)[...,:3]);output=np.empty_like(color);h,w=color.shape[:2]
# This is illumination without material colour, so its albedo guide is white
# inside the atlas islands. Material colour remains separate in the GLB.
albedo=np.ascontiguousarray(np.repeat(np.any(color>0,axis=-1)[...,None],3,axis=2).astype(np.float32))
f=filter_new(device,b'RT');check()
for name,array in [(b'color',color),(b'albedo',albedo),(b'output',output)]:filter_image(f,name,array.ctypes.data,3,w,h,0,0,0)
filter_bool(f,b'hdr',True);filter_bool(f,b'cleanAux',True);filter_commit(f);check();filter_execute(f);check();filter_release(f)
rgba=np.concatenate([np.maximum(output,0),albedo[...,:1]],axis=-1)
source=oiio.ImageBuf(oiio.ImageSpec(w,h,4,oiio.FLOAT));source.set_pixels(oiio.ROI(0,w,0,h,0,1,0,4),np.ascontiguousarray(rgba))
# Fill unused atlas space before mip generation, so lower mips cannot mix
# occupied islands with black texels and produce dark/coloured seams.
filled=oiio.ImageBufAlgo.fillholes_pushpull(source).get_pixels(oiio.FLOAT)[...,:3]
# Keep 32 extra texels of protection rather than shipping a fully filled atlas.
maskImage=oiio.ImageBuf(oiio.ImageSpec(w,h,1,oiio.FLOAT));maskImage.set_pixels(oiio.ROI(0,w,0,h,0,1,0,1),albedo[...,:1])
expanded=oiio.ImageBufAlgo.dilate(maskImage,65,65).get_pixels(oiio.FLOAT)[...,:1]
filled=np.where(expanded>.5,filled,0)
sp=oiio.ImageSpec(w,h,3,oiio.HALF);sp.attribute('compression','zip');b=oiio.ImageBuf(sp);b.set_pixels(oiio.ROI(0,w,0,h,0,1,0,3),np.ascontiguousarray(filled));b.write(str(P/(label+'-clean.exr')))
result={'width':w,'height':h,'rawMaximum':float(color.max()),'filteredMaximum':float(output.max()),'meanAbsoluteChange':float(np.mean(np.abs(output-color)))}
(P/(label+'-denoise-report.json')).write_text(json.dumps(result,indent=2));print('CEILING_DENOISED',label,json.dumps(result),flush=True)
device_release(device)

/** Original landing mask, evaluated in PRJ_ROOT Blender coordinates for colour and shadow. */
export const surfaceFormationGLSL=`
float surfaceFormation(vec3 position,vec4 timing,vec4 sweep,vec4 axis,float frame){
 vec3 p=vec3(position.x,-position.z,position.y);
 float noise=mapRangeLinear(noiseTexFac(p,2.6,2.0,.5,2.0,0.0,true),.3,.7,0.0,1.0,true);
 float gradient=clamp((length(p-vec3(.211,.321,.877))-timing.z)/max(timing.w-timing.z,.001),0.0,1.0);
 float mask=clamp(mix(noise,gradient,.45),0.0,1.0);
 if(sweep.w>.5)mask=clamp(mix(clamp((dot(p,axis.xyz)-sweep.x)/(sweep.y-sweep.x),0.0,1.0),noise,sweep.z),0.0,1.0);
 float sinceLanding=frame-(timing.x+mask*timing.y+axis.w);
 float aa=fwidth(sinceLanding);
 return smoothstep(-.25-aa,1.75+aa,sinceLanding);
}`;

import { MeshStandardMaterial, type WebGLRenderer } from "three";
import { localEnvironment } from "./local-environment";

/** World-space slate detail avoids stretching on the unwrapped diagnostic slides. */
export function slideMaterial(gl: WebGLRenderer, side: boolean) {
  const material = new MeshStandardMaterial({
    name: side ? "Slide | Charcoal edge" : "Slide | Warm honed slate",
    color: side ? "#242424" : "#38332f",
    roughness: 0.72,
    metalness: side ? 0.22 : 0.08,
    envMap: localEnvironment(gl),
    envMapIntensity: 0.25,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vSlatePosition;")
      .replace(
        "#include <project_vertex>",
        "vSlatePosition=(modelMatrix*vec4(transformed,1.0)).xyz;\n#include <project_vertex>",
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vSlatePosition;\nfloat slateNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);vec3 q=i+f;return .5+.5*sin(dot(q,vec3(12.7,17.1,8.3)));}",
      )
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\ndiffuseColor.rgb*=.99+.02*slateNoise(vSlatePosition*4.0);",
      )
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+.02*(slateNoise(vSlatePosition*12.)-.5),.5,.9);",
      );
  };
  material.customProgramCacheKey = () => "slide-slate-world-detail-v1";
  return material;
}

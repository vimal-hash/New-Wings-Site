import type { Material } from "three";
import { SCREEN_GLOW, theatreOpening } from "./theatre-opening-state";

/** Separate room formation from house lighting. The screen fill approximates area bounce on existing bakes. */
export function applyTheatreOpeningMaterial(
  material: Material,
  screen = false,
  emitter = false,
  physical = false,
) {
  if (material.userData.theatreOpening) return;
  material.userData.theatreOpening = true;
  const compile = material.onBeforeCompile,
    key = material.customProgramCacheKey();
  material.onBeforeCompile = function (shader, renderer) {
    compile.call(this, shader, renderer);
    shader.uniforms.openingActive = theatreOpening.active;
    shader.uniforms.openingRoom = theatreOpening.room;
    shader.uniforms.cinemaHouse = theatreOpening.house;
    shader.uniforms.cinemaScreenPower = theatreOpening.screenPower;
    const common = "varying vec3 vOpeningWorld;\nvarying vec3 vOpeningNormal;\n";
    shader.vertexShader = common + shader.vertexShader;
    const vertex = `vec4 openingPosition=vec4(position,1.);
      #ifdef USE_INSTANCING
        openingPosition=instanceMatrix*openingPosition;
      #endif
      vOpeningWorld=(modelMatrix*openingPosition).xyz;
      vOpeningNormal=normalize(mat3(modelMatrix)*normal);`;
    if (shader.vertexShader.includes("#include <begin_vertex>"))
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\n" + vertex,
      );
    else shader.vertexShader = shader.vertexShader.replace("gl_Position=", vertex + "\ngl_Position=");
    shader.fragmentShader =
      `uniform float openingActive,openingRoom,cinemaHouse,cinemaScreenPower;\n${common}
      float cinemaScreenSample(vec3 source,vec3 p,vec3 n){
        vec3 ray=source-p;float d2=dot(ray,ray);
        return max(0.,dot(n,ray*inversesqrt(max(d2,.01))))/(1.+.045*d2);
      }
      vec3 cinemaScreenFill(vec3 base){
        vec3 n=normalize(vOpeningNormal),p=vOpeningWorld;
        float area=cinemaScreenSample(vec3(.011,3.24,25.1),p,n)*.36;
        area+=cinemaScreenSample(vec3(-4.,2.,25.1),p,n)*.16;
        area+=cinemaScreenSample(vec3(4.,2.,25.1),p,n)*.16;
        area+=cinemaScreenSample(vec3(-4.,4.5,25.1),p,n)*.16;
        area+=cinemaScreenSample(vec3(4.,4.5,25.1),p,n)*.16;
        vec3 reflectance=clamp(sqrt(max(base,vec3(0.))),vec3(.07),vec3(.7));
        return reflectance*vec3(.34,.38,.43)*${SCREEN_GLOW.toFixed(3)}*area;
      }\n` + shader.fragmentShader;
    const reveal = screen
      ? "float openingAmount=1.;"
      : `
      float openingDepth=clamp((25.5-vOpeningWorld.z)/27.,0.,1.);
      float openingAmount=openingActive>.5?smoothstep(openingDepth*.6,openingDepth*.6+.4,openingRoom):1.;
      if(openingAmount<.001)discard;`;
    if (shader.fragmentShader.includes("#include <opaque_fragment>")) {
      // Powered down, the screen is a pale matte surface under the house lights.
      const response = screen
        ? "outgoingLight=mix(vec3(.15,.155,.165)*cinemaHouse*roomFill,outgoingLight*(1.+.18*(1.-cinemaHouse)),cinemaScreenPower);"
        : physical
          ? "outgoingLight*=openingAmount;"
          : `
        if(cinemaHouse<1.){
        float cinemaLuma=dot(outgoingLight,vec3(.2126,.7152,.0722));
        float cinemaResidual=${emitter ? ".0004" : "mix(.006,.0008,smoothstep(.12,.55,cinemaLuma))"};
        vec3 cinemaDark=outgoingLight*cinemaResidual+cinemaScreenFill(outgoingLight)*${
          emitter ? ".18" : "1."
        };
        outgoingLight=mix(cinemaDark,outgoingLight,cinemaHouse);
        }
        outgoingLight*=openingAmount;`;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `${reveal}\n${response}\n#include <opaque_fragment>`,
      );
    } else {
      // Live mirrors already see the dark room and bright screen; do not dim them twice.
      shader.fragmentShader = shader.fragmentShader.replace("void main(){", "void main(){\n" + reveal + "\n");
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <colorspace_fragment>",
        `gl_FragColor.rgb*=openingAmount;\n#include <colorspace_fragment>`,
      );
    }
  };
  material.customProgramCacheKey = () =>
    key + "|theatre-opening-cinema-v6|" + screen + "|" + emitter + "|" + physical;
}

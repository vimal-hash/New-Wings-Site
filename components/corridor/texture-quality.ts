import type { WebGLRenderer } from "three";

const desktopTextures: Record<string, string> = {
  "/textures/theatre/ceiling/ceiling-light-2k.ktx2": "/textures/theatre/ceiling/ceiling-compressed-6k.ktx2",
  "/textures/theatre/floor/floor-slab-balanced-2048.ktx2": "/textures/theatre/floor/floor-slab-compressed-6k.ktx2",
  "/textures/corridor/wall-red/corridor-left-clean-2k-v2.ktx2": "/textures/corridor/wall-red/corridor-left-clean-6k-v2.ktx2",
  "/textures/corridor/floor/corridor-floor-light-2k.ktx2": "/textures/corridor/floor/corridor-floor-compressed-6k.ktx2",
};

export function isMobileDevice() {
  if (typeof navigator === "undefined") return true;
  // The existing local phone test must cover textures/DPR as well as effects.
  // Resizing a workstation viewport alone does not change its device identity.
  if(typeof location!=="undefined"&&/^(localhost|127\.)/.test(location.hostname)){
    const test=new URLSearchParams(location.search);
    if(test.has("diagnostics")&&test.get("fx-test")==="mobile")return true;
  }
  const nav = navigator as Navigator & { userAgentData?: { mobile: boolean } };
  return nav.userAgentData?.mobile === true || /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent)
    || (/Macintosh|MacIntel/.test(nav.userAgent + nav.platform) && nav.maxTouchPoints > 1);
}

/** Select before loading: phones/tablets never request the desktop 6K files. */
export function textureForDevice(url: string, gl: WebGLRenderer) {
  return !isMobileDevice() && gl.capabilities.maxTextureSize >= 6144 ? desktopTextures[url] ?? url : url;
}

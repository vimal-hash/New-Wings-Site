let supported: boolean | undefined;

/** Ask the browser for the same WebGL generation as the theatre, before requesting any models. */
export function supportsTheatreGraphics() {
  if (supported !== undefined) return supported;
  try {
    const gl = document.createElement("canvas").getContext("webgl2", {
      failIfMajorPerformanceCaveat: true,
      powerPreference: "high-performance",
    });
    supported = false;
    if (gl) {
      try {
        // Some browsers allow a software context even with the caveat flag. These names
        // identify CPU rasterizers. Physical graphics cards still use the site's drawing test.
        const info = gl.getExtension("WEBGL_debug_renderer_info");
        const renderer: string = gl.getParameter(info?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER) || "";
        supported =
          !gl.isContextLost() &&
          !/swiftshader|llvmpipe|softpipe|microsoft basic render driver/i.test(renderer);
      } finally {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      }
    }
  } catch {
    supported = false;
  }
  return supported;
}

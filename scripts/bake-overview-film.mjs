// Rebuild the Products wear maps and the non-WebGL projection. --wear-only skips the projection.
// Requires Playwright (available to Node), Chromium and ffmpeg. CHROME_PATH can select a local browser.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = fileURLToPath(new URL("../", import.meta.url));
const output = join(root, "public/images/overview/projection");
const scratch = await mkdtemp(join(tmpdir(), "nw-projection-"));
const modules = new Set(["film-material", "film-data", "film-wear", "projection-timing"]);
const server = createServer(async (req, res) => {
  try {
    const path = req.url;
    if (path === "/") {
      res.setHeader("Content-Type", "text/html");
      return res.end('<link rel="icon" href="data:,"><script type="importmap">{"imports":{"three":"/three.module.js"}}</script>');
    }
    if (path === "/three.module.js" || path === "/three.core.js") {
      res.setHeader("Content-Type", "text/javascript");
      return res.end(await readFile(new URL(basename(path), import.meta.resolve("three"))));
    }
    if (modules.has(path.slice(1))) {
      const source = await readFile(join(root, "components/film-reel", path.slice(1) + ".ts"), "utf8");
      res.setHeader("Content-Type", "text/javascript");
      return res.end(ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}}).outputText);
    }
    if (/^\/film\/[a-z0-9-]+\.webp$/.test(path)) return res.end(await readFile(join(root, "public", path)));
    res.writeHead(404).end();
  } catch (error) { res.writeHead(500).end(String(error)); }
});

let browser;
try {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    // Use the browser's regular canvas rasterizer for the original handling marks.
    // Off-screen builds without a GPU can still bake the WebGL projection in software.
    args: ["--enable-gpu", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage();
  page.on("console", m => { if (m.type() === "error") console.error(m.text()); });
  await page.goto("http://127.0.0.1:" + server.address().port);
  for (const size of ["full", "small"]) {
    const png = await page.evaluate(async (small) => {
      const { wearTexture } = await import("/film-wear");
      const map = wearTexture(small, 1);
      const data = map.image.toDataURL("image/png").split(",")[1];
      map.dispose();
      return data;
    }, size === "small");
    // These are three independent data channels. A lossy colour conversion changes the shader.
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", "pipe:0",
      "-c:v", "libwebp", "-lossless", "1", "-compression_level", "6", join(root, "public/film", `wear-${size}.webp`)],
      { input: Buffer.from(png, "base64") });
  }
  if (!process.argv.includes("--wear-only")) await bakeProjection(page);
} finally {
  await browser?.close();
  server.close();
  await rm(scratch,{recursive:true,force:true});
}

async function bakeProjection(page) {
  await mkdir(output, { recursive: true });
  const products = await page.evaluate(async () => {
    const T = await import("three");
    const { filmLooks, FILM_LOOK } = await import("/film-material");
    const { wearTexture } = await import("/film-wear");
    const { FILM_PRODUCTS, FRAME_PITCH } = await import("/film-data");
    const { FILM_RATE, flickerAt } = await import("/projection-timing");
    const renderer = new T.WebGLRenderer({ preserveDrawingBuffer: true, antialias: false });
    const camera = new T.OrthographicCamera(-1, 1, 1, -1, .01, 20);
    camera.position.z = 6;
    const maps = await Promise.all(FILM_PRODUCTS.map(p => new T.TextureLoader().loadAsync(p.picture)));
    maps.forEach(map => { map.colorSpace = T.SRGBColorSpace; });
    const film = filmLooks(maps);
    film.wear.value = wearTexture(false, 1);
    film.lamp.uLamp.value = 1;
    // In the authored strip, the photograph occupies the top part of the 1.783 x 1.4232 window.
    const width = 1.783, top = .7116, height = 1.4232 - .407;
    const sheet = new T.PlaneGeometry(width, height).translate(0, top - height / 2, 0);
    const picture = new T.Mesh(sheet);
    const scene = new T.Scene();
    scene.add(picture);
    const grab = (type, quality) => renderer.domElement.toDataURL(type, quality).split(",")[1];
    window.picture = index => {
      const { width: w, height: h } = maps[index].image;
      renderer.setSize(w, h);
      Object.assign(camera, { left:-width/2, right:width/2, top, bottom:top-height });
      camera.updateProjectionMatrix();
      film.look.uScreen.value.set(w, h);
      film.lamp.uLampX.value = index * FRAME_PITCH;
      picture.material = film.pictures[index];
      picture.material.defines.FILM_SURFACE_ONLY = 1;
      renderer.render(scene, camera);
      return grab("image/webp", .91);
    };
    // Separate the photograph from the screen-space projection. One loop can cover the HTML
    // titles, side cards and surrounding wall together, just as a single projector does.
    const field = new T.PlaneGeometry(2,2);
    const overlay = new T.ShaderMaterial({
      defines: { FILM_NO_GRAIN: 1 },
      uniforms: film.look,
      vertexShader: "void main(){gl_Position=vec4(position.xy,0.,1.);}",
      fragmentShader: FILM_LOOK + "\nvoid main(){gl_FragColor=vec4(filmLook(vec3(.5)),1.);}",
    });
    const screen = new T.Scene(), quad = new T.Mesh(field);
    quad.frustumCulled = false;
    screen.add(quad);
    window.layer = (frame, background) => {
      renderer.setSize(768, 432);
      film.look.uScreen.value.set(768,432);
      film.look.uFrame.value = Math.max(0,frame);
      film.look.uScratch.value = frame < 0 ? 0 : 1;
      film.look.uFlicker.value = frame < 0 ? 1 : flickerAt(frame);
      quad.material = background ? film.void : overlay;
      if (background) {
        quad.material.defines.FILM_SURFACE_ONLY = 1;
        quad.material.uniforms.uAspect.value = 768/432;
      }
      renderer.render(screen,camera);
      return frame < 0 ? grab("image/webp",.85) : grab("image/png");
    };
    return { files: FILM_PRODUCTS.map(p=>p.picture), rate: FILM_RATE };
  });
  for (const [index, name] of products.files.entries()) {
    await writeFile(join(output, basename(name)), Buffer.from(await page.evaluate(i => window.picture(i), index), "base64"));
  }
  for (const [name, wall] of [["wall.webp", true], ["still.webp", false]]) {
    await writeFile(join(output, name), Buffer.from(await page.evaluate(w => window.layer(-1,w), wall), "base64"));
  }
  for (let frame = 0; frame < 4 * products.rate; frame++) {
    const data = await page.evaluate(n => window.layer(n,false), frame);
    await writeFile(join(scratch, String(frame).padStart(3,"0") + ".png"), Buffer.from(data,"base64"));
  }
  execFileSync("ffmpeg", ["-hide_banner","-loglevel","error","-y","-framerate",String(products.rate),"-i",join(scratch,"%03d.png"),"-an","-c:v","libx264","-preset","slow","-crf","29","-pix_fmt","yuv420p","-movflags","+faststart",join(output,"projection.mp4")]);
}

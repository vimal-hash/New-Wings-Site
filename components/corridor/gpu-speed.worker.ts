/**
 * The graphics speed test for gpu-speed.ts, in a worker so the page's loader keeps moving. It draws the two kinds of
 * work the site's own drawing is made of, and times each by waiting for the chip to finish:
 * - threads: thin ribbons, 400,000 triangles a draw, like the rope's threads and the models;
 * - pixels: blur passes over a 1024 × 1024 picture, nine reads a pixel, like the glow and full-screen effects.
 * Batches grow until each takes a few ms, so the wait itself does not swamp the timing, and the test runs long enough
 * for a chip that starts idle to reach its full speed. When the page has a saved speed for this same chip, the worker
 * only names the chip and draws nothing.
 */

const LONGEST_MS = 800; // ms of timed drawing
const BATCH_MS = 4; // ms a batch grows to
const MOST_DRAWS = 128,
  MOST_PASSES = 256;
const STRIPS = 1000,
  SEGMENTS = 200; // 400,000 triangles a draw
const SIZE = 1024; // blur picture, pixels across
const DEPTH_SIZE = 512; // thread picture, pixels across

type Samples = { draws: [number, number][]; passes: [number, number][] };
type Reply = ({ chip: string } & (Samples | { saved: true })) | { error: string };

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<{ savedChip: string | null } | null>) => void) | null;
  postMessage: (message: Reply) => void;
};
worker.onmessage = ({ data }) => {
  try {
    worker.postMessage(measure(data?.savedChip ?? null));
  } catch (error) {
    worker.postMessage({ error: String(error) });
  }
};

function measure(savedChip: string | null): Reply {
  const gl = new OffscreenCanvas(1, 1).getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
  }) as WebGL2RenderingContext | null;
  if (!gl) return { error: "no WebGL 2 in a worker" };
  try {
    const named = gl.getExtension("WEBGL_debug_renderer_info"),
      chip = String(gl.getParameter(named ? named.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    return chip === savedChip ? { chip, saved: true } : { chip, ...run(gl) };
  } finally {
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

function made<T>(value: T | null): T {
  if (value === null) throw new Error("WebGL object not created");
  return value;
}

function run(gl: WebGL2RenderingContext): Samples {
  const program = (vertex: string, fragment: string) => {
    const linked = made(gl.createProgram());
    for (const [type, source] of [
      [gl.VERTEX_SHADER, vertex],
      [gl.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = made(gl.createShader(type));
      gl.shaderSource(shader, "#version 300 es\nprecision highp float;\n" + source);
      gl.compileShader(shader);
      gl.attachShader(linked, shader);
    }
    gl.linkProgram(linked);
    if (!gl.getProgramParameter(linked, gl.LINK_STATUS))
      throw new Error(String(gl.getProgramInfoLog(linked)));
    return linked;
  };
  const target = (size: number) => {
    const texture = made(gl.createTexture());
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, size, size);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    const framebuffer = made(gl.createFramebuffer());
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    return { texture, framebuffer };
  };

  // Threads: rows of thin wavy ribbons, drawn many times at different turns with depth testing.
  const points = new Float32Array(STRIPS * (SEGMENTS + 1) * 6),
    order = new Uint32Array(STRIPS * SEGMENTS * 6);
  for (let s = 0, v = 0, k = 0; s < STRIPS; s++) {
    const row = (s / STRIPS) * 2 - 1,
      phase = s * 0.37,
      z = (s % 17) / 17;
    for (let i = 0; i <= SEGMENTS; i++, v += 6) {
      const x = (i / SEGMENTS) * 2 - 1,
        y = row + 0.05 * Math.sin(x * 9 + phase);
      points[v] = points[v + 3] = x;
      points[v + 1] = y;
      points[v + 4] = y + 0.004;
      points[v + 2] = points[v + 5] = z;
      if (i < SEGMENTS) {
        const a = (s * (SEGMENTS + 1) + i) * 2;
        order.set([a, a + 1, a + 2, a + 1, a + 3, a + 2], k);
        k += 6;
      }
    }
  }
  const threads = program(
    `layout(location = 0) in vec3 position; uniform mat4 view; uniform float turn; out float shade;
    void main() {
      vec3 p = position;
      float c = cos(turn + p.x), s = sin(turn + p.x);
      p.yz = mat2(c, -s, s, c) * p.yz * .5;
      vec4 q = view * vec4(p, 1.);
      shade = .5 + .5 * q.z;
      gl_Position = q;
    }`,
    `in float shade; out vec4 colour; void main() { colour = vec4(vec3(shade), 1.); }`,
  );
  const ribbons = made(gl.createVertexArray());
  gl.bindVertexArray(ribbons);
  gl.bindBuffer(gl.ARRAY_BUFFER, made(gl.createBuffer()));
  gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, made(gl.createBuffer()));
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, order, gl.STATIC_DRAW);
  gl.bindVertexArray(null);
  const threadTarget = target(DEPTH_SIZE);
  const depth = made(gl.createRenderbuffer());
  gl.bindRenderbuffer(gl.RENDERBUFFER, depth);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, DEPTH_SIZE, DEPTH_SIZE);
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
  const view = gl.getUniformLocation(threads, "view"),
    turn = gl.getUniformLocation(threads, "turn"),
    matrix = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0.5, 0, 0, 0, 0.5, 1]);
  const drawThreads = (count: number) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, threadTarget.framebuffer);
    gl.viewport(0, 0, DEPTH_SIZE, DEPTH_SIZE);
    gl.useProgram(threads);
    gl.bindVertexArray(ribbons);
    gl.enable(gl.DEPTH_TEST);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (let d = 0; d < count; d++) {
      matrix[0] = Math.cos(d * 0.21);
      matrix[2] = Math.sin(d * 0.21) * 0.3;
      gl.uniformMatrix4fv(view, false, matrix);
      gl.uniform1f(turn, d * 0.1);
      gl.drawElements(gl.TRIANGLES, order.length, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
    gl.disable(gl.DEPTH_TEST);
  };

  // Pixels: a nine-read blur, back and forth between two large pictures.
  const blur = program(
    `void main() { vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2); gl_Position = vec4(p * 2. - 1., 0., 1.); }`,
    `uniform sampler2D image; uniform vec2 stride; out vec4 colour;
    void main() {
      vec2 uv = gl_FragCoord.xy / ${SIZE}.;
      vec4 sum = vec4(0.);
      for (int i = -4; i <= 4; i++) sum += texture(image, uv + stride * float(i));
      colour = sum / 9. + vec4(.001);
    }`,
  );
  const pictures = [target(SIZE), target(SIZE)];
  const stride = gl.getUniformLocation(blur, "stride");
  const drawBlur = (count: number) => {
    gl.useProgram(blur);
    gl.viewport(0, 0, SIZE, SIZE);
    for (let p = 0; p < count; p++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, pictures[(p + 1) & 1].framebuffer);
      gl.bindTexture(gl.TEXTURE_2D, pictures[p & 1].texture);
      gl.uniform2f(stride, p & 1 ? 0 : 1.5 / SIZE, p & 1 ? 1.5 / SIZE : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  };

  // Reading one pixel back waits for everything drawn before it.
  const pixel = new Uint8Array(4);
  const finish = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel),
    nothing = () => {};
  const time = (work: () => void) => {
    finish();
    const started = performance.now();
    work();
    finish();
    return performance.now() - started;
  };
  time(() => {
    drawThreads(1);
    drawBlur(2);
  }); // first use: the programs are compiled and the chip wakes; not counted

  const samples: Samples = { draws: [], passes: [] };
  const start = performance.now();
  let draws = 2,
    passes = 4,
    wait = Infinity;
  while (performance.now() - start < LONGEST_MS) {
    wait = Math.min(wait, time(nothing)); // the wait itself, with nothing drawn
    const at = Math.round(performance.now() - start),
      threadMs = time(() => drawThreads(draws)) - wait,
      blurMs = time(() => drawBlur(passes)) - wait;
    if (threadMs > 0) samples.draws.push([at, +(threadMs / draws).toFixed(5)]);
    if (blurMs > 0) samples.passes.push([at, +(blurMs / passes).toFixed(5)]);
    if (threadMs < BATCH_MS && draws < MOST_DRAWS) draws *= 2;
    if (blurMs < BATCH_MS && passes < MOST_PASSES) passes *= 2;
  }
  return samples;
}

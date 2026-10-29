const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require(require.resolve('sharp', { paths: [require.resolve('next')] }));

const width = 2048;
const height = 1152;
const pixels = width * height;
const assets = path.join(__dirname, 'assets');
const layers = [
  { name: 'background', file: 'codex-clipboard-62ee8d9d-cc6b-41eb-b499-3aeea97fb795.png' },
  { name: 'decorations', file: 'codex-clipboard-3d30fe7d-cf79-4ffc-947f-bf601afd49f0.png', offset: 8, secondAlpha: 0.30, thirdOffset: 17, thirdAlpha: 0.15, secondSigma: 0.6, thirdSigma: 2.0 },
  { name: 'text', file: 'codex-clipboard-ed88df88-f623-4b07-84e1-ca504133744b.png', offset: -14, secondAlpha: 0.32, thirdOffset: -29, thirdAlpha: 0.17, secondSigma: 0.8, thirdSigma: 2.6 },
  { name: 'logo', file: 'codex-clipboard-fb396ca7-0c00-4da1-b1eb-3dfe5a8131cd.png', offset: -23, secondAlpha: 0.34, thirdOffset: -46, thirdAlpha: 0.18, secondSigma: 1.0, thirdSigma: 3.2 },
];

function digest(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function over(target, source, dx = 0, opacity = 1) {
  for (let y = 0; y < height; y++) {
    const start = Math.max(0, -dx);
    const end = Math.min(width, width - dx);
    for (let x = start; x < end; x++) {
      const s = (y * width + x) * 4;
      const a = source[s + 3] / 255 * opacity;
      if (a === 0) continue;
      const d = (y * width + x + dx) * 4;
      for (let c = 0; c < 3; c++) target[d + c] = Math.round(source[s + c] * a + target[d + c] * (1 - a));
      target[d + 3] = 255;
    }
  }
}

async function softened(source, sigma, contour = false) {
  const premultiplied = Buffer.alloc(source.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    let alpha = source[i + 3] / 255;
    if (contour && alpha > 0) {
      let minAlpha = alpha;
      // An inner silhouette band follows the existing alpha and original colour.
      // This avoids tinting the artwork or introducing new geometry/content.
      for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1]]) {
        const xx = x + dx;
        const yy = y + dy;
        const neighbour = xx < 0 || xx >= width || yy < 0 || yy >= height ? 0 : source[(yy * width + xx) * 4 + 3] / 255;
        minAlpha = Math.min(minAlpha, neighbour);
      }
      alpha = Math.max(0, alpha - minAlpha);
    }
    for (let c = 0; c < 3; c++) premultiplied[i + c] = Math.round(source[i + c] * alpha);
    premultiplied[i + 3] = Math.round(alpha * 255);
  }
  // Blur premultiplied colour and alpha as four ordinary channels so transparent
  // black cannot bleed into the visible edge. Do not blur the whole composition.
  const colour = await sharp(premultiplied, { raw: { width, height, channels: 4 } }).removeAlpha().blur(sigma).raw().toBuffer();
  const alphaChannel = Buffer.alloc(pixels);
  for (let p = 0; p < pixels; p++) alphaChannel[p] = premultiplied[p * 4 + 3];
  const blurredAlpha = await sharp(alphaChannel, { raw: { width, height, channels: 1 } }).blur(sigma).greyscale().raw().toBuffer();
  const result = Buffer.alloc(source.length);
  for (let p = 0; p < pixels; p++) {
    const a = blurredAlpha[p];
    for (let c = 0; c < 3; c++) result[p * 4 + c] = a > 0 ? Math.min(255, Math.round(colour[p * 3 + c] * 255 / a)) : 0;
    result[p * 4 + 3] = a;
  }
  return result;
}

async function main() {
  await fs.mkdir(assets, { recursive: true });
  const cleanPath = path.join(assets, 'screen-clean.png');
  const cleanBefore = digest(await fs.readFile(cleanPath));
  const sources = [];
  for (const settings of layers) {
    const destination = path.join(assets, `layer-${settings.name}.png`);
    let png;
    try { png = await fs.readFile(destination); }
    catch { png = await fs.readFile(path.join('C:/Users/Admin/AppData/Local/Temp', settings.file)); await fs.writeFile(destination, png); }
    const metadata = await sharp(png).metadata();
    if (metadata.width !== width || metadata.height !== height) throw new Error(`Incorrect canvas for ${settings.name}`);
    sources.push({ settings, raw: await sharp(png).ensureAlpha().raw().toBuffer() });
  }
  const result = Buffer.from(sources[0].raw);
  const rebuilt = Buffer.from(sources[0].raw);
  for (const { settings, raw } of sources.slice(1)) {
    const third = await softened(raw, settings.thirdSigma, true);
    const second = await softened(raw, settings.secondSigma);
    // Ghosts behind the unmodified main keep lettering and logo detail sharp.
    over(result, third, settings.thirdOffset, settings.thirdAlpha);
    over(result, second, settings.offset, settings.secondAlpha);
    over(result, raw);
    over(rebuilt, raw);
  }
  const original = await sharp(await fs.readFile(cleanPath)).ensureAlpha().raw().toBuffer();
  let cleanError = 0;
  for (let p = 0; p < pixels; p++) for (let c = 0; c < 3; c++) cleanError += Math.abs(rebuilt[p * 4 + c] - original[p * 4 + c]);
  const outputPath = path.join(assets, 'screen-ghosted-three-copy-v1.png');
  await sharp(result, { raw: { width, height, channels: 4 } }).removeAlpha().png().toFile(outputPath);
  const cleanAfter = digest(await fs.readFile(cleanPath));
  if (cleanBefore !== cleanAfter) throw new Error('Clean master changed');
  const report = {
    mode: 'Deterministic source-layer compositing; no AI regeneration',
    width, height, output: path.basename(outputPath), cleanUnchanged: cleanBefore === cleanAfter,
    rebuiltCleanMeanChannelError: cleanError / (pixels * 3),
    colourTreatment: 'Original source RGB; no red/cyan or cool-tint recolouring',
    mainCopy: 'Original source pixels at original coordinates, no blur or opacity reduction',
    thirdCopy: 'Artistic faint contour, not a third physical eye channel',
    layers,
  };
  await fs.writeFile(path.join(__dirname, 'three-copy-v1-settings.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}

main().catch(error => { console.error(error); process.exitCode = 1; });

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require(require.resolve('sharp', { paths: [require.resolve('next')] }));

async function main() {
  const assets = path.join(__dirname, 'assets');
  const destination = 'C:/Users/Admin/.codex/visualizations/2026/10/09/01a12012-6bd4-7681-9f97-1b59a739ff3b/cinema-lens-comparison.html';
  await fs.mkdir(assets, { recursive: true });
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const inputs = [
    ['screen-clean', 'C:/Users/Admin/AppData/Local/Temp/codex-clipboard-e73e8249-f4ff-48e4-aa3a-25c8d99a6986.png'],
    ['screen-ghosted-candidate', 'C:/Users/Admin/AppData/Local/Temp/codex-clipboard-2aa392fd-08e3-494a-9d0b-9846ca626f7f.png'],
  ];
  const encoded = [];
  for (const [name, source] of inputs) {
    const png = await fs.readFile(source);
    const metadata = await sharp(png).metadata();
    if (metadata.width !== 2048 || metadata.height !== 1152) throw new Error(`${name}: unexpected dimensions`);
    await fs.writeFile(path.join(assets, `${name}.png`), png);
    // Lossless browser encoding only: no resizing, filtering or creative editing.
    const webp = await sharp(png).webp({ lossless: true, effort: 5 }).toBuffer();
    const original = await sharp(png).ensureAlpha().raw().toBuffer();
    const decoded = await sharp(webp).ensureAlpha().raw().toBuffer();
    if (!original.equals(decoded)) throw new Error(`${name}: lossless round trip differs`);
    await fs.writeFile(path.join(assets, `${name}.webp`), webp);
    encoded.push(`data:image/webp;base64,${webp.toString('base64')}`);
    console.log(JSON.stringify({ name, width: metadata.width, height: metadata.height, webpBytes: webp.length, pixelsVerified: true, sourceSha256: crypto.createHash('sha256').update(png).digest('hex') }));
  }
  const template = await fs.readFile(path.join(__dirname, 'lens-comparison.template.html'), 'utf8');
  const fragment = template.replace('__CLEAN_IMAGE_DATA__', encoded[0]).replace('__GHOST_IMAGE_DATA__', encoded[1]);
  if (Buffer.byteLength(fragment) >= 1000000) throw new Error('Fragment exceeds inline preview budget');
  await fs.writeFile(destination, fragment);
  console.log(JSON.stringify({ preview: destination, bytes: Buffer.byteLength(fragment) }));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });

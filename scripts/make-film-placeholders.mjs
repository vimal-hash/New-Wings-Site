// Makes the six stand-in pictures for the film reel (Section 1). Replace each PNG with the real product picture later; keep the name and the 1404 x 800 shape.
// Usage: node scripts/make-film-placeholders.mjs
import { createRequire } from "node:module";
import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const pnpm = join(process.cwd(), "node_modules/.pnpm");
const sharp = require(
  join(
    pnpm,
    readdirSync(pnpm).find((name) => name.startsWith("sharp@")),
    "node_modules/sharp",
  ),
);
const W = 1404,
  H = 800; // the picture window is 1.783 x 1.016
const OUT = "public/film";
mkdirSync(OUT, { recursive: true });

for (let n = 1; n <= 6; n++) {
  const id = String(n).padStart(2, "0");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><radialGradient id="g" cx="50%" cy="46%" r="72%"><stop offset="0" stop-color="#d9d9d9"/><stop offset=".55" stop-color="#8c8c8c"/><stop offset="1" stop-color="#2b2b2b"/></radialGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <g stroke="#1a1a1a" stroke-opacity=".35" stroke-width="2" fill="none">
    <line x1="0" y1="0" x2="${W}" y2="${H}"/><line x1="${W}" y1="0" x2="0" y2="${H}"/>
    <circle cx="${W / 2}" cy="${H / 2}" r="${H * 0.36}"/><rect x="40" y="40" width="${W - 80}" height="${
      H - 80
    }"/>
  </g>
  <text x="${W / 2}" y="${
    H / 2 + 86
  }" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="250" fill="#111" fill-opacity=".82">${id}</text>
  <text x="${W / 2}" y="${
    H - 84
  }" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" letter-spacing="10" fill="#111" fill-opacity=".7">PLACEHOLDER PICTURE</text>
</svg>`;
  const file = join(OUT, `placeholder-${id}.png`);
  const info = await sharp(Buffer.from(svg))
    .greyscale()
    .png({ compressionLevel: 9, palette: true, colours: 128 })
    .toFile(file);
  console.log(file, info.width + "x" + info.height, info.size + " bytes");
}

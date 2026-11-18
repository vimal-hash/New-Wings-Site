// 6K upgrade guard: compares public/models, public/textures and the three texture manifests with the pre-upgrade
// snapshot (docs/restoration/6k-baseline.json). Only the seven approved targets may change; every GLB must be identical.
// Usage: node scripts/surface-bake/check-6k.mjs
import fs from "node:fs";
import crypto from "node:crypto";
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const base = JSON.parse(fs.readFileSync("docs/restoration/6k-baseline.json")).files;
const list = (d) =>
  fs
    .readdirSync(d, { recursive: true })
    .map((f) => d + "/" + f.split(String.fromCharCode(92)).join("/"))
    .filter((f) => fs.statSync(f).isFile());
const now = [
  ...list("public/models"),
  ...list("public/textures"),
  "components/corridor/baked-surfaces.json",
  "components/corridor/theatre-ceiling-assets.json",
  "components/corridor/theatre-left-wall-assets.json",
];
// Approved targets: their old texture may be removed and replaced by a -6k file in the same folder.
// UV sidecars are not in the list: the atlas mapping is preserved, so they must stay byte-identical.
const allowed = [
  /^public\/textures\/theatre\/left-wall\/left-wall-surface(-6k)?\.ktx2$/,
  /^public\/textures\/theatre\/right-wall\/right-wall(-6k)?\.ktx2$/,
  /^public\/textures\/theatre\/floor\/floor-slab(-6k)?\.ktx2$/,
  /^public\/textures\/theatre\/ceiling\/ceiling-surface-edges(-6k)?\.ktx2$/,
  /^public\/textures\/corridor\/wall-red\/corridor-wall-red(-6k)?\.ktx2$/,
  /^public\/textures\/corridor\/wall-connecting\/corridor-wall-connecting(-6k)?\.ktx2$/,
  /^public\/textures\/corridor\/floor\/corridor-floor(-6k)?\.ktx2$/,
  /^components\/corridor\/(baked-surfaces|theatre-ceiling-assets|theatre-left-wall-assets)\.json$/,
];
const ok = (f) => allowed.some((r) => r.test(f));
let bad = 0;
const changed = [],
  removed = [],
  added = [];
for (const [f, { sha256 }] of Object.entries(base)) {
  if (!fs.existsSync(f)) {
    (ok(f) ? removed : (bad++, removed)).push(f + (ok(f) ? "" : " (NOT ALLOWED)"));
    continue;
  }
  if (sha(f) !== sha256) (ok(f) ? changed : (bad++, changed)).push(f + (ok(f) ? "" : " (NOT ALLOWED)"));
}
for (const f of now)
  if (!(f in base)) (ok(f) ? added : (bad++, added)).push(f + (ok(f) ? "" : " (NOT ALLOWED)"));
const glbs = Object.keys(base).filter((f) => f.endsWith(".glb"));
const glbOk = glbs.every((f) => fs.existsSync(f) && sha(f) === base[f].sha256);
console.log(
  JSON.stringify(
    {
      baselineFiles: Object.keys(base).length,
      glbs: glbs.length,
      glbsIdentical: glbOk,
      changed,
      removed,
      added,
    },
    null,
    1,
  ),
);
console.log(bad || !glbOk ? `CHECK6K FAILED ${bad}` : "CHECK6K OK");
process.exit(bad || !glbOk ? 1 : 0);

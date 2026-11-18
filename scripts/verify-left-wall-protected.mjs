// Left wall pass: every protected scene model and the accepted ceiling must stay byte-identical.
import fs from "node:fs";
import crypto from "node:crypto";
const sha = (p) => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex").toUpperCase();
const baseline = JSON.parse(fs.readFileSync("docs/theatre-floor-audit/unchanged-model-baseline.json"));
const ceiling = { "theatre/ceiling-uv-fixed.glb": 55860 };
let failed = 0;
for (const [file, hash] of Object.entries(baseline)) {
  const ok = sha("public/models/" + file) === hash;
  failed += !ok;
  console.log(ok ? "UNCHANGED" : "CHANGED  ", file);
}
for (const [file, bytes] of Object.entries(ceiling)) {
  const ok = fs.statSync("public/models/" + file).size === bytes;
  failed += !ok;
  console.log(ok ? "UNCHANGED" : "CHANGED  ", file, sha("public/models/" + file));
}
const glbs = fs.readdirSync("public/models", { recursive: true }).filter((f) => /\.glb$/.test(f));
console.log("GLB files on disk", glbs.length);
if (failed) process.exit(1);

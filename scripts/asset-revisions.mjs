import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const revisions = {};
function add(file) {
  const url = "/" + path.relative("public", file).replaceAll("\\", "/");
  revisions[url] = createHash("sha256").update(fs.readFileSync(file)).digest("hex").slice(0, 12);
}
function walk(dir, extension) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) walk(file, extension);
    else if (extension.test(item.name)) add(file);
  }
}
for (const dir of ["models", "textures", "basis", "draco"])
  walk(path.join("public", dir), /\.(?:glb|ktx2|bin|gz|wasm|js)$/);
for (const dir of ["rope-model", "rope-laptop", "rope-flight-laptop"])
  walk(path.join("public", dir), /\.(?:glb|bin|png)$/);
add(path.join("public", "images", "theatre-screen-ghosted.webp"));
fs.writeFileSync("components/corridor/asset-revisions.json", JSON.stringify(revisions, null, 2) + "\n");
console.log("Versioned assets:", Object.keys(revisions).length);

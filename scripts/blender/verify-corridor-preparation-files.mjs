import fs from "node:fs";
import crypto from "node:crypto";
const b = JSON.parse(fs.readFileSync("docs/corridor-preparation/baseline.json"));
const changed = Object.entries(b)
  .filter(
    ([p, h]) =>
      !fs.existsSync(p) || crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex") !== h,
  )
  .map(([p]) => p);
const current = ["public", "components", "app"].flatMap((d) =>
  fs
    .readdirSync(d, { recursive: true })
    .map((f) => d + "/" + f.split(String.fromCharCode(92)).join("/"))
    .filter((f) => fs.statSync(f).isFile()),
);
const added = current.filter((p) => !(p in b));
const result = {
  protectedFiles: Object.keys(b).length,
  changed,
  added,
  noRuntimeChanges: changed.length === 0 && added.length === 0,
};
fs.writeFileSync("docs/corridor-preparation/protected-verification.json", JSON.stringify(result, null, 2));
console.log(result);
if (!result.noRuntimeChanges) process.exitCode = 1;

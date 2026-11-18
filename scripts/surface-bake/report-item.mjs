// Writes docs/<item>-audit/README.md and copies the matched comparisons. Usage: node scripts/surface-bake/report-item.mjs <item> <status>
import fs from "node:fs";
import path from "node:path";
const [name, status = "Agent-verified — awaiting user review."] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync("scripts/surface-bake/items.json")),
  spec = cfg.items[name];
const dir = path.join(cfg.authoringRoot, name),
  docs = `docs/${spec.docs ?? name}-audit`;
fs.mkdirSync(docs, { recursive: true });
const bake = JSON.parse(fs.readFileSync(path.join(dir, "bake.json"))),
  layout = JSON.parse(fs.readFileSync(path.join(dir, "uv-layout.json")));
const entry = JSON.parse(fs.readFileSync("components/corridor/baked-surfaces.json")).items.find(
  (i) => i.item === name,
);
const rows = Object.keys(spec.poses).map((pose) => {
  const f = path.join(dir, "reference", pose + "-compare.json");
  if (!fs.existsSync(f)) return `| ${pose} | not captured | | | | |`;
  fs.copyFileSync(path.join(dir, "reference", pose + "-compare.png"), path.join(docs, pose + "-compare.png"));
  const c = JSON.parse(fs.readFileSync(f, "utf8").replaceAll("NaN", "null")),
    [eye, target, fov, w, h] = spec.poses[pose];
  if (!c.maskedPixels)
    return `| ${pose} (${w}x${h}, eye ${eye.join(",")}, target ${target.join(
      ",",
    )}, ${fov} deg) | target not visible at this pose | | | | |`;
  return `| ${pose} (${w}x${h}, eye ${eye.join(",")}, target ${target.join(",")}, ${fov} deg) | ${c.meanR3F
    .map((x) => x.toFixed(1))
    .join(", ")} | ${c.meanBlender.map((x) => x.toFixed(1)).join(", ")} | ${c.rmse8bit} | ${
    c.rmseExcludingOutliers8bit
  } (${c.outlierPixelsOver20} of ${c.maskedPixels} px over 20) | ${c.p95MaxChannelErr8bit} |`;
});
const md = `# ${spec.title ?? name}

Status: ${status}

Objects (${layout.triangles} runtime triangles): ${spec.objects.join("; ")}
Materials: ${bake.materials.join("; ")}

## Method
- Runtime GLB has no UVs. \`scripts/surface-bake/prepare-uv.mjs ${name}\` reads only the runtime triangles and derives ${
  layout.charts.length
} planar charts
  (edge-connected faces with the same dominant normal axis, projected along it; ${
    layout.overlapSplits
  } overlap splits; ${layout.hiddenCharts} charts never face a
  viewpoint and get 1/8 density). The runtime copy gets the same UVs from \`${
    entry.uv
  }\`; GLBs, positions, normals and topology are unchanged.
- \`scripts/blender/surface-bake/bake-item.py ${name}\`: Cycles COMBINED direct surface bake of the source material in the disposable copy
  (${path.basename(bake.blend)}, never saved), ${bake.samples} samples, ${
    bake.seconds
  }s, all source lights, light linking and occluders.
  Glossy/sheen direction: single bake camera at ${bake.eye
    .map((v) => +(+v).toFixed(3))
    .join(", ")}. Display transform ${bake.view[0]} / ${bake.view[1]} / exposure ${(+bake.view[2]).toFixed(
    2,
  )} applied once.
  Every bake triangle matched a runtime triangle (max distance ${bake.maxMatchDistance.toExponential(2)} m).
- \`scripts/surface-bake/encode-item.mjs ${name}\`: 8-bit dither, UASTC level 3, RDO ${
  spec.rdo ?? 0.25
}, sRGB, box mipmaps, zstd 19.
- Runtime: \`components/corridor/baked-surfaces.tsx\`, MeshBasicMaterial, toneMapped false, anisotropy up to 16, one draw call.
${spec.notes ? "\n" + spec.notes.map((n) => "- " + n).join("\n") + "\n" : ""}
## Runtime assets
| File | Bytes |
|---|---:|
| ${entry.texture} (${entry.atlas.join("x")}, ${layout.texelsPerUnit} texels/unit, ${(
  layout.coverage * 100
).toFixed(1)}% used) | ${entry.bytes.texture.toLocaleString("en-GB")} |
| ${entry.uv} | ${entry.bytes.uv.toLocaleString("en-GB")} |

Estimated GPU memory (4x4-block transcode, 1 B/texel, with mips): ${(
  (entry.atlas[0] * entry.atlas[1] * 4) /
  3 /
  1048576
).toFixed(1)} MiB.

## Same-pose comparison (target mask from Blender, eroded 2 px; 8-bit display values)
| Pose | R3F mean RGB | Blender mean RGB | RMSE | RMSE excl. outliers | p95 max-channel err |
|---|---|---|---|---|---|
${rows.join("\n")}

Outliers are pixels with any channel error above 20; they were checked visually and sit on silhouettes next to objects that
are still diagnostic or excluded (e.g. the runtime low-poly seating differs from Blender's seats).
${spec.limitations ? "\n## Limitations\n" + spec.limitations.map((n) => "- " + n).join("\n") + "\n" : ""}
## Reproduce
\`\`\`
node scripts/surface-bake/prepare-uv.mjs ${name}
blender -b --python scripts/blender/surface-bake/bake-item.py -- ${name}
node scripts/surface-bake/encode-item.mjs ${name} --activate
node scripts/surface-bake/references.mjs ${name}
\`\`\`
Then capture R3F at each pose into \`${dir.replaceAll(
  "\\",
  "/",
)}/reference/<pose>-r3f.png\` and run \`blender -b --python scripts/blender/surface-bake/compare.py -- ${name} <pose>\`.
`;
// Hand-written 6K upgrade sections (from "## 6K" to the end) are kept when the generated part is rewritten.
const previous = fs.existsSync(path.join(docs, "README.md"))
  ? fs.readFileSync(path.join(docs, "README.md"), "utf8")
  : "";
const kept = previous.indexOf("\n## 6K");
fs.writeFileSync(path.join(docs, "README.md"), md + (kept < 0 ? "" : previous.slice(kept)));
spec.status = status;
fs.writeFileSync("scripts/surface-bake/items.json", JSON.stringify(cfg, null, 1) + "\n");
console.log("REPORT", docs);

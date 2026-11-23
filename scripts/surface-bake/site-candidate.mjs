// Temporary in-site test of one candidate KTX2: points one target at the candidate under a fresh URL, rebuilds, serves on
// a free loopback port, captures the job's poses, then restores the manifest byte-for-byte and removes the candidate from
// public/. The build left in .next still references the candidate until the next build.
// target: "left-wall" (theatre-left-wall-assets.json) or a baked-surfaces.json item name.
// Usage: node scripts/surface-bake/site-candidate.mjs <target> <candidate.ktx2> <published-name.ktx2> <job.json> <out-dir> [pose...]
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const [target, candidate, published, jobPath, out, ...only] = process.argv.slice(2);
const manifestPath =
  target === "left-wall"
    ? "components/corridor/theatre-left-wall-assets.json"
    : "components/corridor/baked-surfaces.json";
const original = fs.readFileSync(manifestPath, "utf8"),
  manifest = JSON.parse(original);
const entry = target === "left-wall" ? manifest : manifest.items.find((e) => e.item === target);
if (!entry) throw new Error("unknown target " + target);
if (path.basename(published) !== published || !published.endsWith(".ktx2"))
  throw new Error("Expected a .ktx2 filename for the preview");
const url = path.posix.join(path.posix.dirname(entry.texture), published),
  file = "public" + url;
if (fs.existsSync(file)) throw new Error("refusing to overwrite " + file);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let server;
fs.copyFileSync(candidate, file, fs.constants.COPYFILE_EXCL);
try {
  entry.texture = url;
  if (entry.bytes && typeof entry.bytes === "object") entry.bytes.texture = fs.statSync(file).size;
  else if (typeof entry.bytes === "number") entry.bytes = fs.statSync(file).size;
  fs.writeFileSync(
    manifestPath,
    target === "left-wall"
      ? JSON.stringify(manifest, null, 2) + "\n"
      : JSON.stringify(manifest, null, 1) + "\n",
  );
  execFileSync(process.execPath, ["node_modules/next/dist/bin/next", "build"], { stdio: "ignore" });
  const logPath = path.join(path.dirname(out), path.basename(out) + "-server.log");
  const log = fs.openSync(logPath, "w");
  try {
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "0"], {
      stdio: ["ignore", log, log],
      windowsHide: true,
    });
  } finally {
    fs.closeSync(log);
  }
  let origin;
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    if (server.exitCode !== null) throw new Error("Preview server exited. See " + logPath);
    const address = fs.readFileSync(logPath, "utf8").match(/http:\/\/127\.0\.0\.1:\d+/)?.[0];
    if (!address) continue;
    try {
      if ((await fetch(address, { method: "HEAD", signal: AbortSignal.timeout(1000) })).ok) {
        origin = address;
        break;
      }
    } catch {}
  }
  if (!origin) throw new Error("Preview server did not become ready. See " + logPath);
  const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
  const requested = new URL(job.url);
  job.url = origin + requested.pathname + requested.search + requested.hash;
  job.out = out;
  if (only.length) job.poses = job.poses.filter((p) => only.includes(p.name));
  const tmp = path.join(path.dirname(out), path.basename(out) + "-job.json");
  fs.writeFileSync(tmp, JSON.stringify(job));
  const res = execFileSync("node", ["scripts/surface-bake/cdp-capture.mjs", tmp], { encoding: "utf8" });
  const ready = res.split("\n").find((l) => l.startsWith("CDP_READY")) ?? "";
  console.log(
    "SITE_CANDIDATE",
    JSON.stringify({
      target,
      url,
      loaded: ready.includes(published),
      shots: (res.match(/CDP_SHOT/g) || []).length,
    }),
  );
} finally {
  server?.kill();
  fs.writeFileSync(manifestPath, original);
  if (fs.existsSync(file)) fs.rmSync(file);
  console.log("RESTORED", fs.readFileSync(manifestPath, "utf8") === original, !fs.existsSync(file));
}

// Temporary in-site test of one candidate KTX2: points one target at the candidate under a fresh URL, rebuilds, serves on
// 3002, captures the job's poses (cdp-capture.mjs), then restores the manifest byte-for-byte and removes the candidate from
// public/. The build left in .next still references the candidate until the next build.
// target: "left-wall" (theatre-left-wall-assets.json) or a baked-surfaces.json item name.
// Usage: node scripts/surface-bake/site-candidate.mjs <target> <candidate.ktx2> <published-name.ktx2> <job.json> <out-dir> [pose...]
import { execFileSync, execSync, spawn } from "node:child_process";
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
const url = path.posix.join(path.posix.dirname(entry.texture), published),
  file = "public" + url;
if (fs.existsSync(file)) throw new Error("refusing to overwrite " + file);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stopServer = () => {
  const pids = execSync(
    'powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue).OwningProcess"',
    { encoding: "utf8" },
  )
    .split(/\s+/)
    .filter(Boolean);
  for (const pid of new Set(pids)) {
    const cmd = execSync(
      `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`,
      { encoding: "utf8" },
    );
    if (cmd.includes("next") && cmd.includes("start"))
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
  }
};
try {
  fs.copyFileSync(candidate, file);
  entry.texture = url;
  if (entry.bytes && typeof entry.bytes === "object") entry.bytes.texture = fs.statSync(file).size;
  else if (typeof entry.bytes === "number") entry.bytes = fs.statSync(file).size;
  fs.writeFileSync(
    manifestPath,
    target === "left-wall"
      ? JSON.stringify(manifest, null, 2) + "\n"
      : JSON.stringify(manifest, null, 1) + "\n",
  );
  stopServer();
  execFileSync("node", ["node_modules/next/dist/bin/next", "build"], { stdio: "ignore" });
  const log = fs.openSync(path.join(path.dirname(out), "srv3002.log"), "w");
  spawn("node", ["node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0", "--port", "3002"], {
    detached: true,
    stdio: ["ignore", log, log],
  }).unref();
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      if ((await fetch("http://localhost:3002/")).ok) break;
    } catch {}
  }
  const job = JSON.parse(fs.readFileSync(jobPath, "utf8"));
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
  fs.writeFileSync(manifestPath, original);
  if (fs.existsSync(file)) fs.rmSync(file);
  console.log("RESTORED", fs.readFileSync(manifestPath, "utf8") === original, !fs.existsSync(file));
}

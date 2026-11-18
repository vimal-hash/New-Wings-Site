import revisions from "./asset-revisions.json";
import firstPaint from "./first-paint-textures.json";

/** Stable content versions make repeat visits reusable without stale edited assets.
 * The detail flag selects the approved full atlas instead of its exact stored mip. */
export function assetURL(url: string) {
  if (!url.startsWith("/")) return url;
  const split = url.indexOf("?"),
    path = split < 0 ? url : url.slice(0, split),
    params = new URLSearchParams(split < 0 ? "" : url.slice(split + 1));
  const full = params.has("detail");
  params.delete("detail");
  const resolved = params.get("v") === (revisions as Record<string, string>)[path];
  const selected = full || resolved ? path : (firstPaint as Record<string, string>)[path] ?? path;
  const version = (revisions as Record<string, string>)[selected];
  if (!version) return url;
  params.set("v", version);
  return selected + "?" + params.toString();
}
export function hasFirstPaintMip(url: string) {
  return url in firstPaint;
}

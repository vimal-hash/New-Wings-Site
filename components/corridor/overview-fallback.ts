import { journeyControls } from "./journey-controls";

// Count only time the visitor actually spends waiting for a required 3D asset.
export function onVisibleLoadTimeout(expire: () => void, limit = 10_000) {
  let remaining = limit;
  let started = 0;
  let timer: number | undefined;
  function stop() {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", sync);
  }
  function sync() {
    if (timer !== undefined) {
      remaining -= performance.now() - started;
      window.clearTimeout(timer);
      timer = undefined;
    }
    if (document.hidden) return;
    started = performance.now();
    timer = window.setTimeout(() => {
      stop();
      expire();
    }, Math.max(0, remaining));
  }
  document.addEventListener("visibilitychange", sync);
  sync();
  return stop;
}

const sections = ["products", "about", "team", "testimonials"] as const;

function overviewSection() {
  const journey = journeyControls.read();
  if (journey.phase === "logoReveal" || journey.phase === "logoDone" || journey.pageReturning) return "vision";
  if (journey.phase === "pageReturnLoading") return "testimonials";
  if (journey.phase === "page") return sections[journey.visiblePageSection - 1] ?? "products";
  if (!journey.loaderDone || ["intro", "glassesExit", "idle"].includes(journey.phase)) return "theatre";
  return "products";
}

let switching = false;
export function switchToOverview() {
  if (switching) return;
  switching = true;
  const url = new URL(location.href);
  url.searchParams.set("view", "overview");
  url.hash = overviewSection();
  // Leaving the document also releases its renderers, workers and sound. Reloading this URL stays in the overview.
  location.replace(url.href);
}

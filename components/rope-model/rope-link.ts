import type { FlightGlide } from "./rope-flight";

/** What a page holding the flight shares with it. The rope pages behave exactly as before without one. */
export type RopeLink = {
  /** Actual covered starting pose, before any new gesture is followed. */
  startZ: number;
  /** The picture is fully hidden by something in front: no frames are drawn. */
  covered: boolean;
  /** Hidden calibration may pause while another canvas is animating. */
  shouldWarm?: () => boolean;
  /** Asks for a frame. Set by the rope page once its canvas exists. */
  wake: (() => void) | null;
  /** The scrolling layer, once it exists. */
  attach(element: HTMLDivElement): void;
  scroll(share: number): void;
  /** Where the camera is, once a frame, in the same frame as the picture. */
  camera(z: number): void;
  /** The scroll share the camera follows, for this share of the real scroll. */
  flightShare(share: number): number;
  /** The flight can be flown. */
  ready(): void;
  /** A load or GPU preparation error should release the section scroll. */
  failed(): void;
  /** The page's unbroken legs: seconds to hold at the section's white first, where that white ends, and the camera's
   * world units flown at a scroll share. `take` is filled in by the glide while it runs: the page passes it the site's
   * scroll steps (scroll-step.ts). */
  glide: FlightGlide;
};

/** The camera and the HTML planes use the same position on the same animation frame.
 * Native scrolling still drives the standalone studies, keyboard jumps and reduced motion. */
export function observeRopeScroll(element: HTMLElement, update: (share: number) => void, link?: RopeLink) {
  const publish = (share: number) => {
    update(share);
    link?.scroll(share);
  };
  const read = () => {
    if (link?.glide.driving) return;
    const room = element.scrollHeight - element.clientHeight;
    publish(room > 0 ? element.scrollTop / room : 0);
  };
  if (link) link.glide.publish = publish;
  read();
  element.addEventListener("scroll", read, { passive: true });
  window.addEventListener("resize", read);
  return () => {
    element.removeEventListener("scroll", read);
    window.removeEventListener("resize", read);
    if (link?.glide.publish === publish) delete link.glide.publish;
  };
}

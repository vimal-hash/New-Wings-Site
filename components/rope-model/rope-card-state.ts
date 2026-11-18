/**
 * Which image the card shows, and when. No drawing here.
 * At a stop, ropes cover nearly the whole screen, so the mouse is almost always on one. Hovering away therefore means leaving the rope that opened the card, not reaching empty space.
 * For the same reason a person who does not want the card can close it. Cards then stay off at this stop, and only the white rope is left, until they are turned back on or the camera leaves the stop.
 */
export const CARD = {
  images: 5,
  rest: 200, // ms on a rope before it counts, so a mouse sweeping across several ropes does not run through the numbers
  leave: 120, // ms off the rope before the card goes, so a shaky hand on the edge of a rope does not close it
  fadeOut: 300, // ms, the card has fully gone before the next can come
};

export function createCardCount(images = CARD.images) {
  let shows = 0,
    open = false,
    shown = -1,
    candidate = -1,
    since = 0,
    awaySince = -1,
    closedAt = -1e9,
    off = false,
    waiting = false;
  const close = (now: number) => {
    open = false;
    shown = -1;
    awaySince = -1;
    closedAt = now;
  };
  return {
    get open() {
      return open;
    },
    /** 1 to images, in turn. Kept only in this page's memory, so a refresh or a new visit starts from the first. */
    get number() {
      return shows === 0 ? 1 : ((shows - 1) % images) + 1;
    },
    /** The person closed the card, and cards are off at this stop. */
    get off() {
      return off;
    },
    /** The close button or Esc. The count stays where it is. */
    dismiss(now: number) {
      if (open) close(now);
      off = true;
      waiting = false;
      candidate = -1;
    },
    /** The corner button. Nothing opens by itself: the mouse must first move back onto the ropes. */
    enable() {
      off = false;
      waiting = true;
      candidate = -1;
    },
    /** The mouse moved over the ropes. */
    moved() {
      waiting = false;
    },
    /** Once a frame. Returns true while a timer is running and more frames are needed. */
    update(now: number, rope: number, atStop: boolean, overCard: boolean) {
      if (!atStop) {
        if (open) close(now);
        candidate = -1;
        off = false;
        waiting = false;
        return false;
      }
      if (off) return false;
      if (open) {
        if (overCard || rope === shown) {
          awaySince = -1;
          return false;
        }
        if (awaySince < 0) awaySince = now;
        if (now - awaySince < CARD.leave) return true;
        close(now);
      }
      if (waiting || rope < 0) {
        candidate = -1;
        return false;
      }
      if (rope !== candidate) {
        candidate = rope;
        since = now;
      }
      if (now - since < CARD.rest || now - closedAt < CARD.fadeOut) return true;
      shows++;
      open = true;
      shown = rope;
      candidate = -1;
      awaySince = -1;
      return false;
    },
  };
}

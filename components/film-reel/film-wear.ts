import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
} from "three";

/** One copy of the wear map covers this much strip, in strip units. It repeats along the strip. */
export const WEAR_SPAN = 5;

const WIDE = 2048,
  TALL = 1024; // drawing size; a small screen gets half of it
const TURN = Math.PI * 2;

// The same marks on every visit: a fixed seed, not Math.random.
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let mixed = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
  return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
};

/**
 * Handling marks of a much-projected strip, kept in three channels:
 * red = scratches, green = dust and fibres, blue = haze from rubbing.
 * The film runs left to right, so most marks lie along that direction.
 */
export function wearTexture(small: boolean, anisotropy: number) {
  const scale = small ? 0.5 : 1;
  const canvas = document.createElement("canvas");
  canvas.width = WIDE * scale;
  canvas.height = TALL * scale;
  const context = canvas.getContext("2d")!;
  const random = seeded(1907),
    between = (low: number, high: number) => low + (high - low) * random();
  const whole = (low: number, high: number) => Math.floor(between(low, high + 1));
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.scale(scale, scale);
  context.globalCompositeOperation = "lighter";
  // A mark near a side edge is drawn again one width away, so the map repeats without a seam.
  const wrapped = (draw: () => void) => {
    for (const shift of [-WIDE, 0, WIDE]) {
      context.save();
      context.translate(shift, 0);
      draw();
      context.restore();
    }
  };

  // Blue: soft haze, where the surface has gone dull.
  for (let index = 0; index < 16; index++) {
    const x = between(0, WIDE),
      y = between(0, TALL),
      wide = between(120, 420),
      tall = between(40, 160),
      turn = between(-0.25, 0.25),
      strength = between(0.05, 0.16);
    wrapped(() => {
      context.translate(x, y);
      context.rotate(turn);
      context.scale(wide, tall);
      const fade = context.createRadialGradient(0, 0, 0, 0, 0, 1);
      fade.addColorStop(0, `rgba(0,0,255,${strength})`);
      fade.addColorStop(0.5, `rgba(0,0,255,${strength * 0.5})`);
      fade.addColorStop(1, "rgba(0,0,255,0)");
      context.fillStyle = fade;
      context.fillRect(-1, -1, 2, 2);
    });
  }
  // Blue: the two sprocket lanes are rubbed by the projector's teeth and rollers.
  for (const lane of [0.075, 0.925]) {
    const middle = lane * TALL,
      reach = between(40, 58);
    const fade = context.createLinearGradient(0, middle - reach, 0, middle + reach);
    fade.addColorStop(0, "rgba(0,0,255,0)");
    fade.addColorStop(0.5, "rgba(0,0,255,1)");
    fade.addColorStop(1, "rgba(0,0,255,0)");
    const slow = whole(1, 3),
      quick = whole(4, 9),
      slowAt = between(0, TURN),
      quickAt = between(0, TURN);
    context.fillStyle = fade;
    for (let x = 0; x < WIDE; x += 16) {
      const along = (x / WIDE) * TURN;
      context.globalAlpha = Math.max(
        0,
        0.11 + 0.07 * Math.sin(along * slow + slowAt) + 0.05 * Math.sin(along * quick + quickAt),
      );
      context.fillRect(x, middle - reach, 16, reach * 2);
    }
    context.globalAlpha = 1;
  }

  // Red: tramlines. Grit in the gate drags one long line down the whole reel; it wanders a little and comes and goes.
  context.lineCap = "butt";
  for (let index = 0; index < 9; index++) {
    const inLane = random() < 0.45;
    const home = inLane
      ? (random() < 0.5 ? between(0.03, 0.12) : between(0.88, 0.97)) * TALL
      : between(0.14, 0.86) * TALL;
    const sway = between(1.5, 6),
      swayTurns = whole(1, 3),
      swayAt = between(0, TURN),
      shake = between(0.4, 1.8),
      shakeTurns = whole(4, 9),
      shakeAt = between(0, TURN);
    const level = between(-0.25, 0.5),
      comeTurns = whole(1, 3),
      comeAt = between(0, TURN),
      flickTurns = whole(5, 11),
      flickAt = between(0, TURN);
    const peak = between(0.25, 0.8),
      wide = between(0.7, 1.4),
      twin = random() < 0.3 ? between(3, 7) : 0;
    const height = (x: number) => {
      const along = (x / WIDE) * TURN;
      return (
        home + sway * Math.sin(along * swayTurns + swayAt) + shake * Math.sin(along * shakeTurns + shakeAt)
      );
    };
    context.lineWidth = wide;
    for (let x = 0; x < WIDE; x += 8) {
      const along = ((x + 4) / WIDE) * TURN;
      const shown =
        Math.min(
          1,
          Math.max(
            0,
            level + 0.7 * Math.sin(along * comeTurns + comeAt) + 0.3 * Math.sin(along * flickTurns + flickAt),
          ),
        ) * peak;
      if (shown < 0.01) continue;
      const from = height(x),
        to = height(x + 8);
      context.strokeStyle = `rgba(255,0,0,${shown})`;
      context.beginPath();
      context.moveTo(x, from);
      context.lineTo(x + 8, to);
      context.stroke();
      if (twin) {
        context.strokeStyle = `rgba(255,0,0,${shown * 0.6})`;
        context.beginPath();
        context.moveTo(x, from + twin);
        context.lineTo(x + 8, to + twin);
        context.stroke();
      }
    }
  }
  // Red: shorter scratches from winding and handling, thin at both ends.
  context.lineCap = "round";
  for (let index = 0; index < 46; index++) {
    const x = between(0, WIDE),
      y = between(0, TALL),
      long = 60 + 560 * random() ** 2,
      turn = random() < 0.15 ? between(-0.5, 0.5) : between(-0.04, 0.04);
    const strength = between(0.2, 0.75),
      wide = between(0.6, 1.3),
      endX = x + Math.cos(turn) * long,
      endY = y + Math.sin(turn) * long;
    wrapped(() => {
      const fade = context.createLinearGradient(x, y, endX, endY);
      fade.addColorStop(0, "rgba(255,0,0,0)");
      fade.addColorStop(0.18, `rgba(255,0,0,${strength})`);
      fade.addColorStop(0.8, `rgba(255,0,0,${strength})`);
      fade.addColorStop(1, "rgba(255,0,0,0)");
      context.strokeStyle = fade;
      context.lineWidth = wide;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(endX, endY);
      context.stroke();
    });
  }
  // Red: small nicks.
  for (let index = 0; index < 70; index++) {
    const x = between(0, WIDE),
      y = between(0, TALL),
      long = between(3, 18),
      turn = random() < 0.2 ? between(0, TURN) : between(-0.25, 0.25),
      strength = between(0.2, 0.6),
      wide = between(0.6, 1.1);
    wrapped(() => {
      context.strokeStyle = `rgba(255,0,0,${strength})`;
      context.lineWidth = wide;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + Math.cos(turn) * long, y + Math.sin(turn) * long);
      context.stroke();
    });
  }

  // Green: dust. It gathers in patches, and each speck is a slightly different shape.
  const patches = Array.from({ length: 13 }, () => ({
    x: between(0, WIDE),
    y: between(0, TALL),
    spread: between(30, 110),
  }));
  for (let index = 0; index < 560; index++) {
    let x = between(0, WIDE),
      y = between(0, TALL);
    if (random() < 0.55) {
      const patch = patches[whole(0, patches.length - 1)];
      x = patch.x + (random() + random() - 1) * patch.spread * 1.6;
      y = patch.y + (random() + random() - 1) * patch.spread;
    }
    const size = 0.5 + 1.9 * random() ** 3,
      strength = between(0.35, 1);
    const bits = Array.from({ length: whole(1, 3) }, () => ({
      x: between(-1, 1) * size,
      y: between(-1, 1) * size,
      wide: size * between(0.6, 1.2),
      tall: size * between(0.4, 1),
      turn: between(0, Math.PI),
    }));
    wrapped(() => {
      context.fillStyle = `rgba(0,255,0,${strength})`;
      for (const bit of bits) {
        context.beginPath();
        context.ellipse(x + bit.x, y + bit.y, bit.wide, bit.tall, bit.turn, 0, TURN);
        context.fill();
      }
    });
  }
  // Green: a few fibres, each a thin bent hair.
  for (let index = 0; index < 10; index++) {
    const x = between(0, WIDE),
      y = between(0, TALL),
      long = between(30, 120),
      turn = between(0, TURN),
      bend = between(-0.5, 0.5) * long,
      strength = between(0.4, 0.8),
      wide = between(0.8, 1.3);
    const endX = x + Math.cos(turn) * long,
      endY = y + Math.sin(turn) * long,
      midX = (x + endX) / 2 - Math.sin(turn) * bend,
      midY = (y + endY) / 2 + Math.cos(turn) * bend;
    wrapped(() => {
      context.strokeStyle = `rgba(0,255,0,${strength})`;
      context.lineWidth = wide;
      context.beginPath();
      context.moveTo(x, y);
      context.quadraticCurveTo(midX, midY, endX, endY);
      context.stroke();
    });
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  texture.flipY = false; // numbers, not colours
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = anisotropy;
  return texture;
}

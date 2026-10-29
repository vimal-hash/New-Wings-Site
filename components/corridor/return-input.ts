/** Keep the closing gesture's momentum from reopening the panel. */
export function createReturnInputGate() {
  let waiting = false, blockedUntil = 0, lastInput = 0;
  return {
    arm(now: number) { waiting = true; blockedUntil = now + 600; lastInput = now; },
    accept(now: number) {
      const quietFor = now - lastInput;
      lastInput = now;
      if (waiting && (now < blockedUntil || quietFor < 220)) return false;
      waiting = false;
      return true;
    },
  };
}

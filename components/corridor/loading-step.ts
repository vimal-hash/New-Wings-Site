/** Startup preparation needs a turn of the event loop even when the browser pauses animation frames. */
export function scheduleLoadingStep(run: () => void) {
  let frame = 0;
  let timer = 0;
  function cancel() {
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", schedule);
  }
  function finish() {
    cancel();
    run();
  }
  function schedule() {
    cancelAnimationFrame(frame);
    window.clearTimeout(timer);
    if (document.hidden) timer = window.setTimeout(finish, 16);
    else frame = requestAnimationFrame(finish);
  }
  document.addEventListener("visibilitychange", schedule);
  schedule();
  return cancel;
}

export function yieldDuringLoading() {
  if (!document.hidden) return new Promise<void>((resolve) => scheduleLoadingStep(resolve));
  // Each call follows a finite piece of GPU work. Give input and visibility events a turn
  // without making each mesh wait for the next throttled background timer.
  return new Promise<void>((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      channel.port2.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

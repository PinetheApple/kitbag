// JS-thread starvation harness for the §13.3 corollary / §5.8 acceptance: a
// synchronous busy-wait that blocks the JS thread. Its point is to let #33
// confirm ON DEVICE that the UI-thread beat sweep keeps running smoothly while
// JS is starved. The pass/fail is a device-side measurement of recorded output
// (§14.1), not a headless assertion and not a judgement by ear.

/** How long the button blocks the JS thread. */
export const STARVATION_MS = 3000;

/** Block the JS thread for durationMs with a spin loop. Deliberately synchronous. */
export function starveJsThread(durationMs: number): void {
  const end = Date.now() + durationMs;
  // Spin: no yield, no await — this is the starvation the test needs.
  while (Date.now() < end) {
    /* block */
  }
}

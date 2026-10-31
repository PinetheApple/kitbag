// The web build has no engine; a clock on performance.now, the base of a web
// touch timestamp, lets the Rig and calibration run silently for layout work.
export const PRESENTATION_RATE = 48_000;
const MS_PER_SECOND = 1000;

export const presentationFrame = (nowMs: number) =>
  (nowMs * PRESENTATION_RATE) / MS_PER_SECOND;

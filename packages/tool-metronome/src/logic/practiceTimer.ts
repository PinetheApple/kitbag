// Practice pill clock (SPEC §5.2: "practice timer pill under the app bar, tap
// to reset"). Formatting only — the pill ticks once a second, which is
// human-speed React state, not a 60fps value (§13.3).

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const PAD_WIDTH = 2;

function pad(value: number): string {
  return String(value).padStart(PAD_WIDTH, '0');
}

/** Elapsed ms -> "12:04", or "1:02:03" once a session passes an hour. */
export function formatPracticeElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / MS_PER_SECOND));
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  const totalMinutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);

  if (hours > 0) return `${String(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${String(minutes)}:${pad(seconds)}`;
}

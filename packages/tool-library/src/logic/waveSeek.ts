export function frameAtTap(
  x: number,
  waveformWidth: number,
  durationFrames: number,
): number | null {
  if (waveformWidth <= 0 || durationFrames <= 0) return null;
  const fraction = Math.min(1, Math.max(0, x / waveformWidth));
  return Math.round(fraction * durationFrames);
}

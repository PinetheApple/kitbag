// Pure geometry for the beat sweep. Marked 'worklet' so it runs on the UI
// thread inside useAnimatedStyle — §13.3, see useBeatSweep. Maps bar_phase
// [0,1) to a horizontal offset.

/** bar_phase [0,1) -> translateX within a track, clamped to the track. */
export function sweepTranslateX(
  phase: number,
  trackWidth: number,
  sweepWidth: number,
): number {
  'worklet';
  const clamped = phase < 0 ? 0 : phase > 1 ? 1 : phase;
  return clamped * (trackWidth - sweepWidth);
}

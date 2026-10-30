export const NO_PULSE = -1;

export interface PulseMarkMetrics {
  readonly mark: number;
  readonly gap: number;
  readonly radius: number;
}

export function pulseMarkFit(
  pulsesPerBeat: number,
  dotSize: number,
  metrics: PulseMarkMetrics,
): PulseMarkMetrics {
  const natural =
    pulsesPerBeat * metrics.mark + (pulsesPerBeat - 1) * metrics.gap;
  const scale = natural > dotSize ? dotSize / natural : 1;
  return {
    mark: metrics.mark * scale,
    gap: metrics.gap * scale,
    radius: metrics.radius * scale,
  };
}

export function soundingPulse(
  barPhase: number,
  beatsPerBar: number,
  pulsesPerBeat: number,
  currentBeat: number,
): number {
  'worklet';
  if (currentBeat < 0 || pulsesPerBeat < 1) return NO_PULSE;
  const barPulse = Math.floor(barPhase * beatsPerBar * pulsesPerBeat);
  return Math.floor(barPulse / pulsesPerBeat) === currentBeat
    ? barPulse
    : NO_PULSE;
}

export function pulseInBeat(
  barPulse: number,
  beat: number,
  pulsesPerBeat: number,
): number {
  'worklet';
  if (barPulse < 0) return NO_PULSE;
  const local = barPulse - beat * pulsesPerBeat;
  return local >= 0 && local < pulsesPerBeat ? local : NO_PULSE;
}

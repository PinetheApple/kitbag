export const NO_PULSE = -1;

export interface PulseMarkMetrics {
  readonly mark: number;
  readonly gap: number;
  readonly radius: number;
}

export function pulseMarkFit(
  pulses: number,
  dotSize: number,
  metrics: PulseMarkMetrics,
): PulseMarkMetrics {
  const natural = pulses * metrics.mark + (pulses - 1) * metrics.gap;
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
  subdivision: number,
  currentBeat: number,
): number {
  'worklet';
  if (currentBeat < 0 || subdivision < 1) return NO_PULSE;
  const pulse = Math.floor(barPhase * beatsPerBar * subdivision);
  return Math.floor(pulse / subdivision) === currentBeat ? pulse : NO_PULSE;
}

export function pulseInBeat(
  pulse: number,
  beat: number,
  subdivision: number,
): number {
  'worklet';
  if (pulse < 0) return NO_PULSE;
  const local = pulse - beat * subdivision;
  return local >= 0 && local < subdivision ? local : NO_PULSE;
}

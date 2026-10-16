// The ▲/▼ beside the BPM readout (#125): one tap moves one swipe step, the
// 1 BPM SPEC §5.2 gives a drag. Clamping to the engine's range happens where
// every nudge lands, core-state's setTempo.

export type TempoArrow = 'up' | 'down';

const ARROW_STEP_BPM = 1;

export function tempoArrowDelta(arrow: TempoArrow): number {
  return arrow === 'up' ? ARROW_STEP_BPM : -ARROW_STEP_BPM;
}

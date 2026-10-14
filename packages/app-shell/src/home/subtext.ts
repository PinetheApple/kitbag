export const UPCOMING_SUBTEXT = 'Coming soon';

export interface MetronomeSummary {
  readonly bpm: number;
  readonly beatsPerBar: number;
  readonly denominator: number;
  readonly running: boolean;
  readonly ramp: {
    readonly enabled: boolean;
    readonly startBpm: number;
    readonly endBpm: number;
  };
}

// Store intent, not engine truth: with a ramp on, the stored BPM is not what
// is sounding, so the ramp's range is shown instead of one number.
function tempo({ bpm, ramp }: MetronomeSummary): string {
  if (ramp.enabled) {
    return `Ramp ${String(ramp.startBpm)}→${String(ramp.endBpm)} BPM`;
  }
  return `${String(bpm)} BPM`;
}

export function metronomeTileSubtext(summary: MetronomeSummary): string {
  return `${tempo(summary)} ${summary.running ? 'playing' : 'ready'}`;
}

export function metronomeResumeSubtitle(summary: MetronomeSummary): string {
  const parts = [
    tempo(summary),
    `${String(summary.beatsPerBar)}/${String(summary.denominator)}`,
  ];
  if (summary.running) parts.push('playing');
  return parts.join(' · ');
}

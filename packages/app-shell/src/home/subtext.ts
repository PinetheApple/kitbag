import { countLabel } from '@kitbag/core-design';
import type { LibrarySummary } from '@kitbag/core-state';

export const UPCOMING_SUBTEXT = 'Coming soon';
export const LIBRARY_UNAVAILABLE_SUBTEXT = 'Library unavailable';

export interface MetronomeSummary {
  readonly bpm: number;
  readonly beatsPerBar: number;
  readonly denominator: number;
  readonly running: boolean;
  readonly ramp: {
    readonly enabled: boolean;
    readonly startBpm: number;
    readonly targetBpm: number;
  };
}

// Store intent, not engine truth: with a ramp on, the stored BPM is not what
// is sounding, so the ramp's range is shown instead of one number.
function tempo({ bpm, ramp }: MetronomeSummary): string {
  if (ramp.enabled) {
    return `Ramp ${String(ramp.startBpm)}→${String(ramp.targetBpm)} BPM`;
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

export function songsTileSubtext(summary: LibrarySummary): string {
  return `${countLabel(summary.songCount, 'song', 'songs')} · ${String(summary.analyzedCount)} analyzed`;
}

export function stemsTileSubtext(summary: LibrarySummary): string {
  return countLabel(summary.stemSongCount, 'stem song', 'stem songs');
}

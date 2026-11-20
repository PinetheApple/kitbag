import type { LoggedStretch, PracticeLog } from '@kitbag/core-db';

export const TIMELINE_ENTRY = { stretch: 'stretch', pause: 'pause' } as const;

export interface TimelineTempoChange {
  readonly atMs: number;
  readonly bpm: number;
}

export interface TimelineStretch {
  readonly kind: typeof TIMELINE_ENTRY.stretch;
  readonly atMs: number;
  readonly playedMs: number;
  readonly startBpm: number;
  readonly tempoChanges: readonly TimelineTempoChange[];
  readonly stretch: LoggedStretch;
}

export interface TimelinePause {
  readonly kind: typeof TIMELINE_ENTRY.pause;
  readonly ms: number;
}

export type TimelineEntry = TimelineStretch | TimelinePause;

function stretchEntry(stretch: LoggedStretch, atMs: number): TimelineStretch {
  return {
    kind: TIMELINE_ENTRY.stretch,
    atMs,
    playedMs: stretch.to - stretch.from,
    startBpm: stretch.settings?.bpm ?? stretch.avgBpm,
    tempoChanges: stretch.tempo.map(([offsetMs, bpm]) => ({
      atMs: atMs + offsetMs,
      bpm,
    })),
    stretch,
  };
}

export function sessionTimeline(log: PracticeLog): readonly TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  let playedMs = 0;
  let previous: LoggedStretch | null = null;
  for (const stretch of log.stretches) {
    const gap = previous === null ? 0 : stretch.from - previous.to;
    if (gap > 0) entries.push({ kind: TIMELINE_ENTRY.pause, ms: gap });
    const entry = stretchEntry(stretch, playedMs);
    entries.push(entry);
    playedMs += entry.playedMs;
    previous = stretch;
  }
  return entries;
}

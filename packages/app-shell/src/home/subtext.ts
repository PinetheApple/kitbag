import type { PracticeSessionListing } from '@kitbag/core-db';
import { countLabel } from '@kitbag/core-design';
import {
  formatClockSeconds,
  groupSessions,
  HISTORY_GROUPING,
  type LibrarySummary,
} from '@kitbag/core-state';

import { daysAgoText, weekdayDate } from '../dates.ts';
import { SEPARATOR } from '../settings/separator.ts';

import { SONG_NOUNS, STEM_SONG_NOUNS, TOOL_NOUNS } from '../nouns.ts';

export const UPCOMING_SUBTEXT = 'Coming soon';
export const MORE_TOOLS_TITLE = 'More tools';
export const MORE_TOOLS_HINT = 'To make one a Home tile, tap Edit on Home.';
export const LIBRARY_UNAVAILABLE_SUBTEXT = 'Library unavailable';
export const PLAY_ALONG_SUBTEXT = 'Sync to Spotify & more';

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
  return `${countLabel(summary.songCount, ...SONG_NOUNS)} · ${String(summary.analyzedCount)} analyzed`;
}

export function moreToolsSubtext(count: number): string {
  return countLabel(count, ...TOOL_NOUNS);
}

export function stemsTileSubtext(summary: LibrarySummary): string {
  return countLabel(summary.stemSongCount, ...STEM_SONG_NOUNS);
}

export const NO_PRACTICE_SUBTEXT = 'No sessions yet';

export function practiceTileSubtext(
  sessions: readonly PracticeSessionListing[],
  now: Date,
): string {
  const [latest] = groupSessions(sessions, HISTORY_GROUPING.day);
  if (latest === undefined) return NO_PRACTICE_SUBTEXT;
  const day = daysAgoText(latest.start, now) ?? weekdayDate(latest.start);
  return `${day} ${SEPARATOR} ${formatClockSeconds(latest.totalSeconds)}`;
}

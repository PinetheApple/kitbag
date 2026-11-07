import { countLabel } from '@kitbag/core-design';
import type {
  getPracticeSessionStore,
  metronomeStore,
  PracticeStretch,
  PracticeSummary,
} from '@kitbag/core-state';

import { formatPracticeElapsed } from './practiceTimer.ts';

export type PracticeSessions = Pick<
  ReturnType<typeof getPracticeSessionStore>,
  'getState'
>;

export type Metronome = Pick<typeof metronomeStore, 'getState'>;

export type SummarySheet = 'summary' | 'none';

export type SaveState = 'idle' | 'saving' | 'failed';

export interface SaveAttempt {
  readonly uuid: string;
  readonly state: Exclude<SaveState, 'idle'>;
}

export interface SummaryButtons {
  readonly saveLabel: string;
  readonly saveDisabled: boolean;
  readonly discardDisabled: boolean;
}

export function endPractice(
  sessions: PracticeSessions,
  resetClock: () => void,
): void {
  sessions.getState().endSession();
  resetClock();
}

export function leavePractice(
  sessions: PracticeSessions,
  metronome: Metronome,
): void {
  const { running, resetPractice } = metronome.getState();
  if (!running) endPractice(sessions, resetPractice);
}

export function savePendingPractice(
  sessions: PracticeSessions,
  onAttempt: (attempt: SaveAttempt | null) => void,
): void {
  const summary = sessions.getState().pending[0];
  if (summary === undefined) return;
  const { uuid } = summary;
  onAttempt({ uuid, state: 'saving' });
  sessions
    .getState()
    .saveSession()
    .then(
      () => {
        onAttempt(null);
      },
      () => {
        onAttempt({ uuid, state: 'failed' });
      },
    );
}

export function summarySheetOnMount(
  pending: readonly PracticeSummary[],
): SummarySheet {
  return pending.length === 0 ? 'none' : 'summary';
}

export function summaryButtons(save: SaveState): SummaryButtons {
  const saving = save === 'saving';
  return {
    saveLabel: save === 'failed' ? 'Try again' : 'Save session',
    saveDisabled: saving,
    discardDisabled: saving,
  };
}

export function practiceContextLine(summary: PracticeSummary): string | null {
  const parts: string[] = [];
  if (summary.setlist !== null) parts.push(summary.setlist.name);
  if (summary.songs.length > 0)
    parts.push(countLabel(summary.songs.length, 'song', 'songs'));
  return parts.length === 0 ? null : parts.join(' · ');
}

export function averageTempoLabel(avgBpm: number): string {
  return `${String(Math.round(avgBpm))} BPM`;
}

export function longestStretchLabel(
  stretch: PracticeStretch | null,
): string | null {
  if (stretch === null) return null;
  const time = formatPracticeElapsed(stretch.ms);
  return stretch.title === null ? time : `${stretch.title} · ${time}`;
}

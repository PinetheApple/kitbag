import { countLabel, type IconName } from '@kitbag/core-design';
import {
  bpmFact,
  clockParts,
  formatClockSeconds,
  keyFact,
  type LibraryChip,
  type LibraryRow,
  type LibrarySongRow,
  type LibraryStemSetRow,
  type SongBadge,
  type SongFact,
} from '@kitbag/core-state';

export function formatLength(totalSeconds: number): string {
  return formatClockSeconds(Math.round(totalSeconds));
}

export function spokenLength(totalSeconds: number): string {
  const { hours, minutes, seconds } = clockParts(Math.round(totalSeconds));
  const parts = [
    hours > 0 ? countLabel(hours, 'hour', 'hours') : '',
    hours > 0 || minutes > 0 ? countLabel(minutes, 'minute', 'minutes') : '',
    countLabel(seconds, 'second', 'seconds'),
  ];
  return parts.filter((part) => part !== '').join(' ');
}

export function rowSubtitle(row: LibraryRow): string | undefined {
  const parts: string[] = [];
  if (row.kind === 'song' && row.artist !== '') parts.push(row.artist);
  if (row.durationSec > 0) parts.push(formatLength(row.durationSec));
  return parts.length === 0 ? undefined : parts.join(' · ');
}

export type BadgeTone = 'default' | 'accent' | 'success' | 'warning';

export interface BadgeSpec {
  readonly key: string;
  readonly label: string;
  readonly spoken: string;
  readonly tone: BadgeTone;
  readonly icon?: IconName;
}

const GRID_BADGE: BadgeSpec = {
  key: 'status',
  label: 'GRID',
  icon: 'check',
  spoken: 'Beat grid ready',
  tone: 'success',
};

const STATUS_BADGES: Readonly<Record<SongBadge, BadgeSpec | null>> = {
  pending: {
    key: 'status',
    label: 'NOT ANALYZED',
    spoken: 'Not analyzed yet',
    tone: 'default',
  },
  analyzing: {
    key: 'status',
    label: 'ANALYZING…',
    spoken: 'Analyzing',
    tone: 'warning',
  },
  grid: GRID_BADGE,
  noGrid: {
    key: 'status',
    label: 'NO GRID',
    spoken: 'No beat grid found',
    tone: 'default',
  },
  failed: null,
};

function factBadge(key: string, fact: SongFact | null): BadgeSpec[] {
  if (fact === null) return [];
  return [{ key, label: fact.text, spoken: fact.spoken, tone: 'default' }];
}

export function songBadges(song: LibrarySongRow, status: SongBadge) {
  const badges = factBadge('bpm', bpmFact(song.bpm));
  const statusBadge = STATUS_BADGES[status];
  if (statusBadge !== null) badges.push(statusBadge);
  return badges;
}

export function stemBadges(row: LibraryStemSetRow): BadgeSpec[] {
  const badges = [
    ...factBadge('bpm', bpmFact(row.bpm)),
    ...factBadge('key', keyFact(row.key, row.scale, null)),
  ];
  if (row.hasGrid) badges.push(GRID_BADGE);
  badges.push({
    key: 'stems',
    label: `STEMS ×${String(row.stemCount)}`,
    spoken: countLabel(row.stemCount, 'stem', 'stems'),
    tone: 'accent',
  });
  return badges;
}

export function spokenRow(
  row: LibraryRow,
  badges: readonly BadgeSpec[],
  failureStatus: string | null,
): string {
  const parts: string[] = [row.title];
  if (row.kind === 'song' && row.artist !== '') parts.push(row.artist);
  else if (row.kind === 'stems') parts.push('stem song');
  if (row.durationSec > 0) parts.push(spokenLength(row.durationSec));
  parts.push(...badges.map((badge) => badge.spoken));
  if (failureStatus !== null) parts.push(failureStatus);
  return parts.join(', ');
}

export const CHIP_LABELS: Readonly<Record<LibraryChip, string>> = {
  all: 'All',
  analyzed: 'Analyzed',
  stems: 'Stems',
  setlists: 'Setlists',
};

import { countLabel, type IconName } from '@kitbag/core-design';
import type {
  LibraryChip,
  LibraryRow,
  LibrarySongRow,
  SongBadge,
} from '@kitbag/core-state';

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const TWO_DIGITS = 2;

const pad = (value: number) => String(value).padStart(TWO_DIGITS, '0');

function clock(totalSeconds: number) {
  const whole = Math.max(0, Math.round(totalSeconds));
  const seconds = whole % SECONDS_PER_MINUTE;
  const minutes = Math.floor(whole / SECONDS_PER_MINUTE);
  return {
    hours: Math.floor(minutes / MINUTES_PER_HOUR),
    minutes: minutes % MINUTES_PER_HOUR,
    seconds,
  };
}

export function formatLength(totalSeconds: number): string {
  const { hours, minutes, seconds } = clock(totalSeconds);
  if (hours > 0) return `${String(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return `${String(minutes)}:${pad(seconds)}`;
}

export function spokenLength(totalSeconds: number): string {
  const { hours, minutes, seconds } = clock(totalSeconds);
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
  grid: {
    key: 'status',
    label: 'GRID',
    icon: 'check',
    spoken: 'Beat grid ready',
    tone: 'success',
  },
  noGrid: {
    key: 'status',
    label: 'NO GRID',
    spoken: 'No beat grid found',
    tone: 'default',
  },
  failed: null,
};

export function songBadges(song: LibrarySongRow, status: SongBadge) {
  const badges: BadgeSpec[] = [];
  if (song.bpm !== null) {
    const bpm = String(Math.round(song.bpm));
    badges.push({
      key: 'bpm',
      label: `${bpm} BPM`,
      spoken: `${bpm} beats per minute`,
      tone: 'default',
    });
  }
  const statusBadge = STATUS_BADGES[status];
  if (statusBadge !== null) badges.push(statusBadge);
  return badges;
}

export function stemBadges(stemCount: number): BadgeSpec[] {
  return [
    {
      key: 'stems',
      label: `STEMS ×${String(stemCount)}`,
      spoken: countLabel(stemCount, 'stem', 'stems'),
      tone: 'accent',
    },
  ];
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

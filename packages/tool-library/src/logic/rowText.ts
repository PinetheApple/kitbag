import { countLabel, type BadgeTone, type IconName } from '@kitbag/core-design';
import {
  bpmFact,
  clockParts,
  formatClockSeconds,
  keyFact,
  type AnalysisFailure,
  type LibraryRow,
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

const STATUS_BADGES: Readonly<Record<SongBadge, BadgeSpec>> = {
  pending: {
    key: 'status',
    label: 'NOT ANALYZED',
    spoken: 'Not analyzed yet',
    tone: 'default',
  },
  analyzing: {
    key: 'status',
    label: 'ANALYZING',
    icon: 'analyzing',
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
  failed: {
    key: 'status',
    label: 'FAILED',
    icon: 'error',
    spoken: 'Analysis failed',
    tone: 'danger',
  },
};

const STATUS_NOTES: Readonly<Partial<Record<SongBadge, string>>> = {
  analyzing: 'analyzing…',
  failed: 'no beat grid',
};

const KEPT_GRID_NOTE = 're-analysis failed';

export function rowBadges(row: LibraryRow, status: SongBadge): BadgeSpec[] {
  if (row.kind === 'song') return [STATUS_BADGES[status]];
  const stems: BadgeSpec = {
    key: 'stems',
    label: `STEMS ×${String(row.stemCount)}`,
    spoken: countLabel(row.stemCount, 'stem', 'stems'),
    tone: 'accent',
  };
  return row.hasGrid ? [stems, GRID_BADGE] : [stems];
}

function rowFacts(row: LibraryRow): SongFact[] {
  const facts = [
    bpmFact(row.bpm),
    row.kind === 'stems' ? keyFact(row.key, row.scale, null) : null,
  ];
  return facts.filter((fact) => fact !== null);
}

export function rowSubtitle(
  row: LibraryRow,
  status: SongBadge,
  failure: AnalysisFailure | null,
): string {
  const note = row.kind === 'song' ? STATUS_NOTES[status] : undefined;
  const facts =
    note === undefined ? rowFacts(row).map((fact) => fact.text) : [note];
  const parts = [
    ...(row.durationSec > 0 ? [formatLength(row.durationSec)] : []),
    ...facts,
    ...(failure?.keptGrid === true ? [KEPT_GRID_NOTE] : []),
  ];
  return parts.join(' · ');
}

export function spokenRow(
  row: LibraryRow,
  status: SongBadge,
  failureStatus: string | null,
): string {
  const parts: string[] = [row.title];
  if (row.kind === 'song' && row.artist !== '') parts.push(row.artist);
  if (row.durationSec > 0) parts.push(spokenLength(row.durationSec));
  if (row.kind === 'stems' || STATUS_NOTES[status] === undefined)
    parts.push(...rowFacts(row).map((fact) => fact.spoken));
  parts.push(...rowBadges(row, status).map((badge) => badge.spoken));
  if (failureStatus !== null) parts.push(failureStatus);
  return parts.join(', ');
}

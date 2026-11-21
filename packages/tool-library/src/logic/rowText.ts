import {
  countLabel,
  FACT_SEPARATOR,
  PLAYING,
  type BadgeTone,
  type IconName,
} from '@kitbag/core-design';
import {
  bpmFact,
  correctedBpm,
  clockParts,
  formatClockSeconds,
  keyFact,
  type AnalysisFailure,
  type LibraryRow,
  type SongBadge,
  type SongFact,
} from '@kitbag/core-state';

import { UNAVAILABLE_TEXT } from './notices.ts';

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
  failed: {
    key: 'status',
    label: 'FAILED',
    icon: 'error',
    spoken: 'Analysis failed',
    tone: 'danger',
  },
};

export type RowPlace = 'here' | 'moving' | 'unavailable';

const PLACE_BADGES: Readonly<Record<Exclude<RowPlace, 'here'>, BadgeSpec>> = {
  moving: {
    key: 'status',
    label: 'MOVING',
    spoken: 'Files moving, still plays',
    tone: 'warning',
  },
  unavailable: {
    key: 'status',
    label: 'NO CARD',
    spoken: `${UNAVAILABLE_TEXT.status}, can’t play`,
    tone: 'danger',
  },
};

const STATUS_NOTES: Readonly<Partial<Record<SongBadge, string>>> = {
  analyzing: 'analyzing…',
  failed: 'no beat grid',
};

const KEPT_GRID_NOTE = 're-analysis failed';

export const NO_BREAK_SPACE = '\u00A0';
const WORD_GAP = / /g;

function unbroken(part: string): string {
  return part.replace(WORD_GAP, NO_BREAK_SPACE);
}

export function songStatusBadge(badge: SongBadge): BadgeSpec {
  return STATUS_BADGES[badge];
}

export function rowBadges(
  row: LibraryRow,
  status: SongBadge,
  place: RowPlace = 'here',
): BadgeSpec[] {
  if (place !== 'here') return [PLACE_BADGES[place]];
  return row.kind === 'song' ? [STATUS_BADGES[status]] : [];
}

function stemsHere(row: LibraryRow, place: RowPlace): boolean {
  return row.kind === 'stems' && place === 'here';
}

export function showsGridIcon(row: LibraryRow, place: RowPlace): boolean {
  return stemsHere(row, place) && row.hasGrid;
}

function spokenStatus(
  row: LibraryRow,
  status: SongBadge,
  place: RowPlace,
): string[] {
  if (!stemsHere(row, place))
    return rowBadges(row, status, place).map((badge) => badge.spoken);
  return [STATUS_BADGES[showsGridIcon(row, place) ? 'grid' : 'noGrid'].spoken];
}

function rowFacts(row: LibraryRow): SongFact[] {
  const facts = [
    bpmFact(
      row.kind === 'song'
        ? correctedBpm(row.bpm, row.tempoCorrection)
        : row.bpm,
    ),
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
  return parts.map(unbroken).join(FACT_SEPARATOR);
}

export function playingSubtitle(row: LibraryRow, subtitle: string): string {
  if (row.kind !== 'stems') return subtitle;
  return [PLAYING, subtitle].filter((part) => part !== '').join(FACT_SEPARATOR);
}

export function spokenRow(
  row: LibraryRow,
  status: SongBadge,
  failureStatus: string | null,
  place: RowPlace = 'here',
): string {
  const parts: string[] = [row.title];
  if (row.artist !== null && row.artist !== '') parts.push(row.artist);
  if (row.durationSec > 0) parts.push(spokenLength(row.durationSec));
  if (row.kind === 'stems' || STATUS_NOTES[status] === undefined)
    parts.push(...rowFacts(row).map((fact) => fact.spoken));
  parts.push(...spokenStatus(row, status, place));
  if (failureStatus !== null) parts.push(failureStatus);
  return parts.join(', ');
}

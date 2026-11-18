import type { BadgeTone } from '@kitbag/core-design';
import type { SongBadge } from '@kitbag/core-state';

export type LockAction = 'click' | 'reanalyse' | 'none';

export interface LockText {
  readonly title: string;
  readonly detail: string;
  readonly action: LockAction;
}

export interface StatusBadge {
  readonly label: string;
  readonly spoken: string;
  readonly tone: BadgeTone;
}

const LOCK_SOURCE = 'phase auto · from beat grid';
const GRID_READY = 'grid ready';
const NO_GRID_TITLE = 'No beat grid';

const ANALYSING: LockText = {
  title: 'Finding the beat',
  detail: 'The click is ready once analysis ends',
  action: 'none',
};

const NO_GRID_TEXT: Readonly<Record<'failed' | 'noGrid', LockText>> = {
  failed: {
    title: NO_GRID_TITLE,
    detail: 'Analysis failed, so no click',
    action: 'reanalyse',
  },
  noGrid: {
    title: NO_GRID_TITLE,
    detail: 'Analysis found no beat, so no click',
    action: 'reanalyse',
  },
};

const ANALYSING_BADGE: StatusBadge = {
  label: 'ANALYZING',
  spoken: 'Analyzing',
  tone: 'warning',
};
const NO_GRID_BADGE: StatusBadge = {
  label: 'NO GRID',
  spoken: NO_GRID_TITLE,
  tone: 'danger',
};

const STATUS_BADGES: Readonly<Record<SongBadge, StatusBadge | null>> = {
  pending: ANALYSING_BADGE,
  analyzing: ANALYSING_BADGE,
  failed: NO_GRID_BADGE,
  noGrid: NO_GRID_BADGE,
  grid: null,
};

function withBpm(bpmText: string | null, detail: string): string {
  return bpmText === null ? detail : `${bpmText} · ${detail}`;
}

export function statusBadge(badge: SongBadge): StatusBadge | null {
  return STATUS_BADGES[badge];
}

export function lockText(
  badge: SongBadge,
  click: boolean,
  bpmText: string | null,
): LockText {
  switch (badge) {
    case 'pending':
    case 'analyzing':
      return ANALYSING;
    case 'failed':
    case 'noGrid':
      return NO_GRID_TEXT[badge];
    case 'grid':
      return click
        ? {
            title: 'Metronome locked',
            detail: withBpm(bpmText, LOCK_SOURCE),
            action: 'click',
          }
        : {
            title: 'Click off',
            detail: withBpm(bpmText, GRID_READY),
            action: 'click',
          };
  }
}

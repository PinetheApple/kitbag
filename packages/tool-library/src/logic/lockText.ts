import {
  bpmFact,
  isUnitySpeed,
  playerSongBadge,
  speedPercentText,
  type AnalysisFailure,
  type SongBadge,
  type SongPlayerStore,
} from '@kitbag/core-state';

import { canReanalyze } from './notices.ts';
import { songStatusBadge, type BadgeSpec } from './rowText.ts';

export type LockAction = 'click' | 'reanalyze' | 'none';

export interface LockText {
  readonly title: string;
  readonly detail: string;
  readonly action: LockAction;
}

const LOCK_PHASE = 'phase auto';
const LOCK_SOURCE = 'from beat grid';
const GRID_READY = 'grid ready';
const NO_GRID_TITLE = 'No beat grid';

const ANALYSING: LockText = {
  title: 'Finding the beat',
  detail: 'The click is ready once analysis ends',
  action: 'none',
};

const FAILED_DETAIL = 'Analysis failed, so no click';
const DAMAGED_DETAIL = 'File may be damaged, so no click';

const NO_BEAT_FOUND: LockText = {
  title: NO_GRID_TITLE,
  detail: 'Analysis found no beat, so no click',
  action: 'reanalyze',
};

function failedText(failure: AnalysisFailure | null): LockText {
  return {
    title: NO_GRID_TITLE,
    detail: failure?.kind === 'damaged' ? DAMAGED_DETAIL : FAILED_DETAIL,
    action: canReanalyze(failure) ? 'reanalyze' : 'none',
  };
}

// The player draws any song it cannot click to as NO GRID, in red.
const PLAYER_NO_GRID: BadgeSpec = {
  ...songStatusBadge('noGrid'),
  tone: 'danger',
};

function lockSource(speed: number): string {
  const how = isUnitySpeed(speed)
    ? LOCK_PHASE
    : `${speedPercentText(speed)} speed`;
  return `${how} · ${LOCK_SOURCE}`;
}

function withBpm(bpmText: string | null, detail: string): string {
  return bpmText === null ? detail : `${bpmText} · ${detail}`;
}

export function playerStatusBadge(badge: SongBadge): BadgeSpec | null {
  if (badge === 'grid') return null;
  return badge === 'failed' || badge === 'noGrid'
    ? PLAYER_NO_GRID
    : songStatusBadge(badge);
}

type PlayerFacts = Pick<SongPlayerStore, 'status' | 'analysisStatus' | 'beats'>;

export type BarBadge = Omit<BadgeSpec, 'key'>;

export function lockBadgeOf({ analysisStatus, beats }: PlayerFacts): SongBadge {
  return playerSongBadge({ analysisStatus, hasGrid: beats.length > 0 });
}

export function barStatusOf(state: PlayerFacts): BadgeSpec | null {
  return state.status === 'ready'
    ? playerStatusBadge(lockBadgeOf(state))
    : null;
}

export function barBadge(
  status: BadgeSpec | null,
  bpm: number | null,
): BarBadge | null {
  if (status !== null) return status;
  const fact = bpmFact(bpm);
  return fact === null
    ? null
    : { label: fact.text, spoken: fact.spoken, tone: 'default' };
}

export interface LockTextInput {
  readonly badge: SongBadge;
  readonly click: boolean;
  readonly bpmText: string | null;
  readonly failure: AnalysisFailure | null;
  readonly speed: number;
}

export function lockText({
  badge,
  click,
  bpmText,
  failure,
  speed,
}: LockTextInput): LockText {
  switch (badge) {
    case 'pending':
    case 'analyzing':
      return ANALYSING;
    case 'failed':
      return failedText(failure);
    case 'noGrid':
      return NO_BEAT_FOUND;
    case 'grid':
      return click
        ? {
            title: 'Metronome locked',
            detail: withBpm(bpmText, lockSource(speed)),
            action: 'click',
          }
        : {
            title: 'Click off',
            detail: withBpm(bpmText, GRID_READY),
            action: 'click',
          };
  }
}

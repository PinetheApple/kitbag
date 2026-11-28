import type { ColorToken, IconName } from '@kitbag/core-design';
import {
  bpmFact,
  isUnitySpeed,
  MANUAL_TEMPO_LABEL,
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

function lockSource(speed: number, manual: boolean): string {
  if (manual) return MANUAL_TEMPO_LABEL;
  const how = isUnitySpeed(speed)
    ? LOCK_PHASE
    : `${speedPercentText(speed)} speed`;
  return `${how} · ${LOCK_SOURCE}`;
}

function withBpm(bpmText: string | null, detail: string): string {
  return bpmText === null ? detail : `${bpmText} · ${detail}`;
}

export function isNoGridBadge(badge: SongBadge): boolean {
  return badge === 'failed' || badge === 'noGrid';
}

export function playerStatusBadge(badge: SongBadge): BadgeSpec | null {
  if (badge === 'grid') return null;
  return isNoGridBadge(badge) ? PLAYER_NO_GRID : songStatusBadge(badge);
}

type PlayerFacts = Pick<
  SongPlayerStore,
  'status' | 'analysisStatus' | 'beats' | 'tempoPreview'
>;

function hasSavedGrid({
  beats,
  tempoPreview,
}: Pick<PlayerFacts, 'beats' | 'tempoPreview'>): boolean {
  return tempoPreview === null ? beats.length > 0 : tempoPreview.savedGrid;
}

export type BarBadge = Omit<BadgeSpec, 'key'>;

export function lockBadgeOf(state: PlayerFacts): SongBadge {
  return playerSongBadge({
    analysisStatus: state.analysisStatus,
    hasGrid: hasSavedGrid(state),
  });
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

export interface LockIcon {
  readonly name: IconName;
  readonly color: ColorToken;
  readonly border: ColorToken;
}

const PLAIN_TILE = { color: 'text', border: 'line' } as const;

export function lockIcon(
  badge: SongBadge,
  click: boolean,
  accentInk: ColorToken,
): LockIcon {
  switch (badge) {
    case 'pending':
    case 'analyzing':
      return { name: 'analyzing', ...PLAIN_TILE };
    case 'failed':
    case 'noGrid':
      return { ...PLAIN_TILE, name: 'error', color: 'redInk' };
    case 'grid':
      return click
        ? { name: 'metronome', color: accentInk, border: 'accentDim' }
        : { name: 'metronome', ...PLAIN_TILE };
  }
}

export interface LockTextInput {
  readonly badge: SongBadge;
  readonly click: boolean;
  readonly bpmText: string | null;
  readonly failure: AnalysisFailure | null;
  readonly speed: number;
  readonly manual: boolean;
}

export function lockText({
  badge,
  click,
  bpmText,
  failure,
  speed,
  manual,
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
            detail: withBpm(bpmText, lockSource(speed, manual)),
            action: 'click',
          }
        : {
            title: 'Click off',
            detail: withBpm(bpmText, manual ? MANUAL_TEMPO_LABEL : GRID_READY),
            action: 'click',
          };
  }
}

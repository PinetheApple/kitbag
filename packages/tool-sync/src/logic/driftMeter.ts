import { MS_PER_SECOND } from '@kitbag/core-db';
import {
  DRIFT_STRIP_SCALE,
  FACT_SEPARATOR,
  type BadgeTone,
} from '@kitbag/core-design';
import {
  formatClockSeconds,
  formatOffsetMs,
  SOURCE_GONE_HOLD_MS,
} from '@kitbag/core-state';

export const DRIFT_STATE = {
  locked: 'locked',
  drift: 'drift',
  paused: 'paused',
  holding: 'holding',
} as const;

export type DriftState = (typeof DRIFT_STATE)[keyof typeof DRIFT_STATE];

export interface DriftInputs {
  readonly lockedAtMs: number;
  readonly songAheadOfClickMs: number | undefined;
  readonly playing: boolean;
  readonly sourceGoneAtMs: number | undefined;
  readonly appLabel: string | undefined;
  readonly nowMs: number;
}

export interface DriftView {
  readonly state: DriftState;
  readonly badge: { readonly label: string; readonly tone: BadgeTone };
  readonly lead: string;
  readonly figures: string | null;
  readonly tail: string;
  readonly reading: string;
  readonly needle: number;
  readonly muted: boolean;
  readonly controls: boolean;
  readonly retapEnabled: boolean;
}

const LOCKED_BADGE = { label: 'LOCKED', tone: 'success' } as const;
const DRIFT_BADGE = { label: 'DRIFT', tone: 'warning' } as const;
const HOLDING_BADGE = { label: 'HOLDING', tone: 'warning' } as const;

export function shownDriftMs(songAheadOfClickMs: number | undefined): number {
  return Math.round(songAheadOfClickMs ?? 0);
}

export function isDrifting(songAheadOfClickMs: number | undefined): boolean {
  return (
    Math.abs(shownDriftMs(songAheadOfClickMs)) > DRIFT_STRIP_SCALE.inTimeMs
  );
}

export type DriftStateInputs = Pick<
  DriftInputs,
  'songAheadOfClickMs' | 'playing' | 'sourceGoneAtMs'
>;

export function driftState(inputs: DriftStateInputs): DriftState {
  if (inputs.sourceGoneAtMs !== undefined) return DRIFT_STATE.holding;
  if (!inputs.playing) return DRIFT_STATE.paused;
  return isDrifting(inputs.songAheadOfClickMs)
    ? DRIFT_STATE.drift
    : DRIFT_STATE.locked;
}

type DriftWords = Pick<DriftView, 'badge' | 'lead' | 'figures' | 'tail'>;

const FIXED_WORDS = {
  paused: {
    badge: LOCKED_BADGE,
    lead: `Paused${FACT_SEPARATOR}resumes on the beat`,
    figures: null,
    tail: '',
  },
  drift: {
    badge: DRIFT_BADGE,
    lead: `Off by more than ${String(DRIFT_STRIP_SCALE.inTimeMs)} ms`,
    figures: null,
    tail: '',
  },
} as const satisfies Record<string, DriftWords>;

function holdingWords(
  goneAtMs: number,
  { appLabel, nowMs }: DriftInputs,
): DriftWords {
  const leftMs = goneAtMs + SOURCE_GONE_HOLD_MS - nowMs;
  const stopped = appLabel === undefined ? 'Stopped' : `${appLabel} stopped`;
  return {
    badge: HOLDING_BADGE,
    lead: `${stopped}${FACT_SEPARATOR}holding `,
    figures: String(Math.max(0, Math.ceil(leftMs / MS_PER_SECOND))),
    tail: ' s',
  };
}

function lockedWords({ lockedAtMs, nowMs }: DriftInputs): DriftWords {
  const agoSeconds = Math.floor((nowMs - lockedAtMs) / MS_PER_SECOND);
  return {
    badge: LOCKED_BADGE,
    lead: `Locked${FACT_SEPARATOR}`,
    figures: formatClockSeconds(Math.max(0, agoSeconds)),
    tail: ' ago',
  };
}

function words(state: DriftState, inputs: DriftInputs): DriftWords {
  if (inputs.sourceGoneAtMs !== undefined)
    return holdingWords(inputs.sourceGoneAtMs, inputs);
  if (state === DRIFT_STATE.paused) return FIXED_WORDS.paused;
  if (state === DRIFT_STATE.drift) return FIXED_WORDS.drift;
  return lockedWords(inputs);
}

export function driftMeterView(inputs: DriftInputs): DriftView {
  const state = driftState(inputs);
  const sounding = state === DRIFT_STATE.locked || state === DRIFT_STATE.drift;
  const driftMs = sounding ? shownDriftMs(inputs.songAheadOfClickMs) : 0;
  return {
    state,
    ...words(state, inputs),
    reading: formatOffsetMs(driftMs),
    needle: driftMs / DRIFT_STRIP_SCALE.fullScaleMs,
    muted: !sounding,
    controls: state !== DRIFT_STATE.drift,
    retapEnabled: state === DRIFT_STATE.locked,
  };
}

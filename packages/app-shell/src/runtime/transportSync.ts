import type { TransportEvent, TransportSetlist } from '@kitbag/core-native';
import type { MetronomeConfig } from '@kitbag/core-state';

export type TransportSource = Pick<
  MetronomeConfig,
  'running' | 'bpm' | 'beatsPerBar' | 'denominator' | 'ramp' | 'practice'
> & { readonly setlist: TransportSetlist | null };

export interface TransportShown {
  readonly playing: boolean;
  readonly bpm: number;
  readonly rampRunning: boolean;
  readonly beatsPerBar: number;
  readonly beatUnit: number;
  readonly practicePlayedMs: number;
  readonly practiceStretchStartedAt: number;
  readonly setlist: TransportSetlist | null;
}

export type TransportStep =
  | { readonly kind: 'show'; readonly shown: TransportShown }
  | { readonly kind: 'hide' }
  | { readonly kind: 'none' };

export function notificationStepAfterAppChange(
  state: TransportSource,
  shown: TransportShown | undefined,
  now: number,
): TransportStep {
  const next = shownFor(state, shown, now);
  if (next === undefined) {
    return shown === undefined ? { kind: 'none' } : { kind: 'hide' };
  }
  return shown !== undefined && sameShown(shown, next)
    ? { kind: 'none' }
    : { kind: 'show', shown: next };
}

// A pause from the notification keeps it up so the click can be resumed from the pocket.
function shownFor(
  state: TransportSource,
  shown: TransportShown | undefined,
  now: number,
): TransportShown | undefined {
  if (state.running) {
    return {
      ...cardOf(state),
      playing: true,
      practiceStretchStartedAt: state.practice.stretchStartedAt ?? now,
    };
  }
  return shown?.playing === false ? { ...shown, ...cardOf(state) } : undefined;
}

function cardOf(
  state: TransportSource,
): Omit<TransportShown, 'playing' | 'practiceStretchStartedAt'> {
  return {
    bpm: state.bpm,
    rampRunning: state.ramp.enabled,
    beatsPerBar: state.beatsPerBar,
    beatUnit: state.denominator,
    practicePlayedMs: state.practice.playedMs,
    setlist: state.setlist,
  };
}

// A paused notification still owns the engine metronome: its Play restarts it.
export function transportActive(
  running: boolean,
  shown: TransportShown | undefined,
): boolean {
  return running || shown !== undefined;
}

// With no card of its own, as after a reload, the app has no tempo to prefer.
export function cardStale(
  shown: TransportShown | undefined,
  event: TransportEvent,
  cardNumber: number,
): boolean {
  return shown !== undefined && event.cardNumber !== cardNumber;
}

// A service on another card reports that card's tempo, so the app's tempo
// stands unless the action itself set one.
export function keepsAppTempo(event: TransportEvent, stale: boolean): boolean {
  return event.rampRunning || (stale && !event.tempoSet);
}

export interface TempoChoice {
  readonly keepTempo: boolean;
}

export function shownAfterNativeChange(
  shown: TransportShown | undefined,
  event: TransportEvent,
  { keepTempo }: TempoChoice,
): TransportShown | undefined {
  if (shown === undefined || event.playback === 'stopped') return undefined;
  const followed = {
    ...shown,
    playing: event.playback === 'playing',
    practicePlayedMs: event.practicePlayedMs,
    practiceStretchStartedAt: event.practiceStretchStartedAt,
  };
  return keepTempo
    ? followed
    : { ...followed, bpm: event.bpm, rampRunning: false };
}

export function storePatchFor(
  event: TransportEvent,
  current: Pick<MetronomeConfig, 'bpm' | 'ramp'>,
  { keepTempo }: TempoChoice,
): Pick<MetronomeConfig, 'running' | 'bpm' | 'ramp' | 'practice'> {
  const running = event.playback === 'playing';
  return {
    running,
    bpm: keepTempo ? current.bpm : event.bpm,
    ramp: keepTempo ? current.ramp : { ...current.ramp, enabled: false },
    practice: {
      playedMs: event.practicePlayedMs,
      stretchStartedAt: running ? event.practiceStretchStartedAt : null,
    },
  };
}

function sameShown(a: TransportShown, b: TransportShown): boolean {
  return (Object.keys(a) as (keyof TransportShown)[]).every((key) =>
    key === 'setlist' ? sameSetlist(a.setlist, b.setlist) : a[key] === b[key],
  );
}

function sameSetlist(a: TransportSetlist | null, b: TransportSetlist | null) {
  if (a === null || b === null) return a === b;
  return (Object.keys(a) as (keyof typeof a)[]).every(
    (key) => a[key] === b[key],
  );
}

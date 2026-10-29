import type { TransportEvent } from '@kitbag/core-native';
import type { MetronomeConfig } from '@kitbag/core-state';

export type TransportSource = Pick<
  MetronomeConfig,
  'running' | 'bpm' | 'beatsPerBar' | 'denominator' | 'ramp' | 'practice'
>;

export interface TransportShown {
  readonly playing: boolean;
  readonly bpm: number;
  readonly rampRunning: boolean;
  readonly beatsPerBar: number;
  readonly beatUnit: number;
  readonly practicePlayedMs: number;
  readonly practiceStretchStartedAt: number;
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
      playing: true,
      bpm: state.bpm,
      rampRunning: state.ramp.enabled,
      beatsPerBar: state.beatsPerBar,
      beatUnit: state.denominator,
      practicePlayedMs: state.practice.playedMs,
      practiceStretchStartedAt: state.practice.stretchStartedAt ?? now,
    };
  }
  return shown?.playing === false
    ? { ...shown, practicePlayedMs: state.practice.playedMs }
    : undefined;
}

// A paused notification still owns the engine metronome: its Play restarts it.
export function transportActive(
  running: boolean,
  shown: TransportShown | undefined,
): boolean {
  return running || shown !== undefined;
}

export function shownAfterNativeChange(
  shown: TransportShown | undefined,
  event: TransportEvent,
): TransportShown | undefined {
  if (shown === undefined || event.playback === 'stopped') return undefined;
  const followed = {
    ...shown,
    playing: event.playback === 'playing',
    practicePlayedMs: event.practicePlayedMs,
    practiceStretchStartedAt: event.practiceStretchStartedAt,
  };
  return event.rampRunning
    ? followed
    : { ...followed, bpm: event.bpm, rampRunning: false };
}

export function storePatchFor(
  event: TransportEvent,
  current: Pick<MetronomeConfig, 'bpm' | 'ramp'>,
): Pick<MetronomeConfig, 'running' | 'bpm' | 'ramp' | 'practice'> {
  const running = event.playback === 'playing';
  return {
    running,
    bpm: event.rampRunning ? current.bpm : event.bpm,
    ramp: event.rampRunning
      ? current.ramp
      : { ...current.ramp, enabled: false },
    practice: {
      playedMs: event.practicePlayedMs,
      stretchStartedAt: running ? event.practiceStretchStartedAt : null,
    },
  };
}

function sameShown(a: TransportShown, b: TransportShown): boolean {
  return (Object.keys(a) as (keyof TransportShown)[]).every(
    (key) => a[key] === b[key],
  );
}

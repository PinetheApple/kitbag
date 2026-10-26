import type { TransportEvent } from '@kitbag/core-native';
import type { MetronomeConfig } from '@kitbag/core-state';

export type TransportSource = Pick<
  MetronomeConfig,
  'running' | 'bpm' | 'beatsPerBar' | 'denominator' | 'ramp' | 'practice'
>;

export interface TransportShown {
  readonly bpm: number;
  readonly rampRunning: boolean;
  readonly beatsPerBar: number;
  readonly beatUnit: number;
  readonly practicePlayedMs: number;
  readonly practiceStartedAt: number;
}

export type TransportStep =
  | { readonly kind: 'show'; readonly shown: TransportShown }
  | { readonly kind: 'hide' }
  | { readonly kind: 'none' };

export function notificationStepAfterAppChange(
  state: TransportSource,
  shown: TransportShown | undefined,
  pausedNatively: boolean,
  now: number,
): TransportStep {
  if (state.running) {
    const next: TransportShown = {
      bpm: state.bpm,
      rampRunning: state.ramp.enabled,
      beatsPerBar: state.beatsPerBar,
      beatUnit: state.denominator,
      practicePlayedMs: state.practice.playedMs,
      practiceStartedAt: state.practice.stretchStartedAt ?? now,
    };
    return shown !== undefined && sameShown(shown, next) && !pausedNatively
      ? { kind: 'none' }
      : { kind: 'show', shown: next };
  }
  // A pause from the notification keeps it up so the click can be resumed from the pocket.
  return shown === undefined || pausedNatively
    ? { kind: 'none' }
    : { kind: 'hide' };
}

export function shownAfterNativeChange(
  shown: TransportShown | undefined,
  event: TransportEvent,
): TransportShown | undefined {
  if (shown === undefined || event.playback === 'stopped') return undefined;
  return event.rampRunning
    ? shown
    : { ...shown, bpm: event.bpm, rampRunning: false };
}

export function storePatchFor(
  event: TransportEvent,
  current: Pick<MetronomeConfig, 'bpm' | 'ramp'>,
): Pick<MetronomeConfig, 'running' | 'bpm' | 'ramp'> {
  return {
    running: event.playback === 'playing',
    bpm: event.rampRunning ? current.bpm : event.bpm,
    ramp: event.rampRunning
      ? current.ramp
      : { ...current.ramp, enabled: false },
  };
}

function sameShown(a: TransportShown, b: TransportShown): boolean {
  return (
    a.bpm === b.bpm &&
    a.rampRunning === b.rampRunning &&
    a.beatsPerBar === b.beatsPerBar &&
    a.beatUnit === b.beatUnit &&
    a.practicePlayedMs === b.practicePlayedMs &&
    a.practiceStartedAt === b.practiceStartedAt
  );
}

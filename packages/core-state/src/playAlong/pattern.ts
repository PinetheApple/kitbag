import {
  KB_METRONOME_SLOT,
  acquireEngineHold,
  type KB_ACCENT,
} from '@kitbag/core-native';

import {
  isBuiltInSoundId,
  mergeSounds,
  resizeAccents,
  subdivisionOf,
  volumeOf,
} from '../metronome/config.ts';
import { groupStartAccents } from '../metronome/meterGroups.ts';
import { meterOf } from '../metronome/patternActions.ts';
import { initialConfig, type MetronomeConfig } from '../metronome/store.ts';
import type { PlayAlongCommands } from './runtime.ts';

export type PlayAlongPattern = Pick<
  MetronomeConfig,
  | 'beatsPerBar'
  | 'denominator'
  | 'subdivision'
  | 'accents'
  | 'sounds'
  | 'volume'
>;

type PatternCommands = Pick<
  PlayAlongCommands,
  'setBeats' | 'setAccent' | 'setSubdivision' | 'setSounds' | 'setVolume'
>;

type SlotResetCommands = Pick<
  PlayAlongCommands,
  'setPoly' | 'setBarMute' | 'setRamp' | 'setCountIn'
>;

export interface PatternEdit {
  readonly pattern: PlayAlongPattern;
  readonly send: (commands: PatternCommands) => void;
}

export function initialPattern(): PlayAlongPattern {
  const { beatsPerBar, denominator, subdivision, accents, sounds, volume } =
    initialConfig();
  return { beatsPerBar, denominator, subdivision, accents, sounds, volume };
}

function sendAccents(
  commands: PatternCommands,
  accents: readonly KB_ACCENT[],
): void {
  accents.forEach((accent, beat) => {
    commands.setAccent(beat, accent);
  });
}

function resetExtras(commands: SlotResetCommands): void {
  const { polyBeats, barMute, ramp, countIn } = initialConfig();
  commands.setPoly(false, polyBeats);
  commands.setBarMute(false, barMute.playBars, barMute.muteBars);
  commands.setRamp(
    false,
    ramp.startBpm,
    ramp.targetBpm,
    ramp.stepBpm,
    ramp.interval,
    ramp.unit,
    ramp.loop,
  );
  commands.setCountIn(countIn.bars, countIn.distinct, countIn.sound);
}

function sendPattern(
  commands: PatternCommands & SlotResetCommands,
  pattern: PlayAlongPattern,
): void {
  resetExtras(commands);
  commands.setBeats(pattern.beatsPerBar, pattern.denominator);
  sendAccents(commands, pattern.accents);
  commands.setSubdivision(pattern.subdivision);
  commands.setSounds(pattern.sounds.normal, pattern.sounds.accent);
  commands.setVolume(pattern.volume);
}

export function enterPlayAlongSlot(
  commands: PlayAlongCommands,
  pattern: PlayAlongPattern,
  latencyOffsetMs: number,
  yieldStandalone: () => () => void,
): () => void {
  const standaloneReturns = yieldStandalone();
  const release = acquireEngineHold(commands);
  commands.metronomeSelectSlot(KB_METRONOME_SLOT.KB_METRONOME_SLOT_PLAY_ALONG);
  sendPattern(commands, pattern);
  commands.setLatencyOffset(latencyOffsetMs);
  return () => {
    commands.metronomeStop();
    commands.metronomeSelectSlot(
      KB_METRONOME_SLOT.KB_METRONOME_SLOT_STANDALONE,
    );
    standaloneReturns();
    release();
  };
}

export function withMeter(
  pattern: PlayAlongPattern,
  beatsPerBar: number,
  denominator: number,
): PatternEdit | undefined {
  const meter = meterOf(beatsPerBar, denominator, pattern.denominator);
  if (meter === undefined) return undefined;
  const accents =
    meter.beats === pattern.beatsPerBar
      ? pattern.accents
      : groupStartAccents(meter.beats);
  return {
    pattern: {
      ...pattern,
      beatsPerBar: meter.beats,
      denominator: meter.denominator,
      accents,
    },
    send: (commands) => {
      commands.setBeats(meter.beats, meter.denominator);
      sendAccents(commands, accents);
    },
  };
}

export function withSubdivision(
  pattern: PlayAlongPattern,
  subdivision: number,
): PatternEdit {
  const next = subdivisionOf(subdivision);
  return {
    pattern: { ...pattern, subdivision: next },
    send: (commands) => {
      commands.setSubdivision(next);
    },
  };
}

export function withAccents(
  pattern: PlayAlongPattern,
  accents: readonly KB_ACCENT[],
): PatternEdit {
  const next = resizeAccents(accents, pattern.beatsPerBar);
  return {
    pattern: { ...pattern, accents: next },
    send: (commands) => {
      sendAccents(commands, next);
    },
  };
}

export function withSounds(
  pattern: PlayAlongPattern,
  normal: number,
  accent: number,
): PatternEdit | undefined {
  const sounds = mergeSounds(pattern.sounds, normal, accent, isBuiltInSoundId);
  if (sounds === undefined) return undefined;
  return {
    pattern: { ...pattern, sounds },
    send: (commands) => {
      commands.setSounds(sounds.normal, sounds.accent);
    },
  };
}

export function withVolume(
  pattern: PlayAlongPattern,
  volume: number,
): PatternEdit {
  const next = volumeOf(volume);
  return {
    pattern: { ...pattern, volume: next },
    send: (commands) => {
      commands.setVolume(next);
    },
  };
}

import {
  KB_METRONOME_SLOT,
  KB_SUBDIVISION_BOUNDS,
  KB_VOLUME_BOUNDS,
  acquireEngineHold,
  type KB_ACCENT,
} from '@kitbag/core-native';

import { clamp, mergeSounds, resizeAccents } from '../metronome/config.ts';
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

function sendPattern(
  commands: PatternCommands,
  pattern: PlayAlongPattern,
): void {
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
): () => void {
  const release = acquireEngineHold(commands);
  commands.metronomeSelectSlot(KB_METRONOME_SLOT.KB_METRONOME_SLOT_PLAY_ALONG);
  sendPattern(commands, pattern);
  commands.setLatencyOffset(latencyOffsetMs);
  return () => {
    commands.metronomeStop();
    commands.metronomeSelectSlot(
      KB_METRONOME_SLOT.KB_METRONOME_SLOT_STANDALONE,
    );
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
  const next = clamp(
    Math.trunc(subdivision),
    KB_SUBDIVISION_BOUNDS.min,
    KB_SUBDIVISION_BOUNDS.max,
  );
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
  const sounds = mergeSounds(pattern.sounds, normal, accent);
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
  const next = clamp(volume, KB_VOLUME_BOUNDS.min, KB_VOLUME_BOUNDS.max);
  return {
    pattern: { ...pattern, volume: next },
    send: (commands) => {
      commands.setVolume(next);
    },
  };
}

import { isGridMeter, type SongPreset } from '@kitbag/core-db';
import type { MediaSessionSnapshot } from '@kitbag/core-native';

import type { LibraryMatch } from '../tempoLadder/libraryMatch.ts';
import {
  identityOf,
  presetForTrack,
  sameIdentity,
  type TrackIdentity,
} from './presetLookup.ts';
import type { PlayAlongRuntime } from './runtime.ts';

export interface PresetMeter {
  readonly beatsPerBar: number;
  readonly denominator: number;
}

export type MeterLookup =
  | { readonly settled: false }
  | { readonly settled: true; readonly meter: PresetMeter | undefined };

export interface PresetMeters {
  readonly meterFor: (
    seen: MediaSessionSnapshot,
    match: LibraryMatch,
  ) => MeterLookup;
  readonly presetFor: (
    seen: MediaSessionSnapshot,
    match: LibraryMatch,
  ) => Promise<SongPreset | undefined>;
  readonly forget: () => void;
}

interface ReadMeter {
  readonly songId: number | undefined;
  readonly identity: TrackIdentity | undefined;
}

interface PresetRead {
  readonly key: ReadMeter;
  readonly preset: Promise<SongPreset | undefined>;
  readonly settled?: { readonly preset: SongPreset | undefined };
}

const PENDING: MeterLookup = { settled: false };

export const sameMeter = (
  a: PresetMeter | undefined,
  b: PresetMeter | undefined,
) => a?.beatsPerBar === b?.beatsPerBar && a?.denominator === b?.denominator;

export const gridMeterOf = (
  preset: SongPreset | undefined,
): PresetMeter | undefined =>
  preset !== undefined && isGridMeter(preset.beatsPerBar)
    ? { beatsPerBar: preset.beatsPerBar, denominator: preset.denominator }
    : undefined;

const keyOf = (seen: MediaSessionSnapshot, match: LibraryMatch): ReadMeter => ({
  songId: match.kind === 'song' ? match.id : undefined,
  identity: identityOf(seen),
});

const sameKey = (a: ReadMeter, b: ReadMeter) =>
  a.songId === b.songId && sameIdentity(a.identity, b.identity);

export function presetMeters(
  runtime: PlayAlongRuntime,
  onSettled: () => void,
): PresetMeters {
  let read: PresetRead | undefined;

  const start = (key: ReadMeter): PresetRead => {
    const preset =
      key.identity === undefined
        ? Promise.resolve(undefined)
        : presetForTrack(runtime.presets(), key.identity, key.songId).catch(
            () => undefined,
          );
    const current = { key, preset };
    read = current;
    void preset.then((found) => {
      if (read !== current) return;
      read = { ...current, settled: { preset: found } };
      onSettled();
    });
    return current;
  };

  const readFor = (seen: MediaSessionSnapshot, match: LibraryMatch) => {
    const key = keyOf(seen, match);
    return read !== undefined && sameKey(read.key, key) ? read : start(key);
  };

  return {
    meterFor: (seen, match) => {
      const { settled } = readFor(seen, match);
      return settled === undefined
        ? PENDING
        : { settled: true, meter: gridMeterOf(settled.preset) };
    },
    presetFor: (seen, match) => readFor(seen, match).preset,
    forget: () => {
      read = undefined;
    },
  };
}

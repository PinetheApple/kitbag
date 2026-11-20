import {
  meterOverrideOf,
  type LinkedPresetValues,
  type SongPreset,
  type SongRecord,
} from '@kitbag/core-db';
import { KB_BPM_BOUNDS } from '@kitbag/core-native';

import {
  accentsOf,
  perAccentSoundsOf,
  presetFromMetronome,
} from '../library/presetMapping.ts';
import { clamp, isCountInBars, resizeAccents } from '../metronome/config.ts';
import { initialConfig } from '../metronome/store.ts';
import type { SongPlayerRuntime } from './runtime.ts';
import { songMeter, type SongClickSettings } from './songClick.ts';
import { recordGrid } from './songGrid.ts';
import { shownGrid, type SongPlayerState } from './state.ts';

type SavedSong = Pick<
  SongPlayerState,
  'title' | 'artist' | 'bpm' | 'clickSettings'
>;

export function presetOfSong(song: SavedSong): LinkedPresetValues {
  const { countInBars, sounds, accents } = song.clickSettings;
  const defaults = initialConfig();
  return {
    ...presetFromMetronome({
      ...defaults,
      bpm: clamp(
        song.bpm ?? defaults.bpm,
        KB_BPM_BOUNDS.min,
        KB_BPM_BOUNDS.max,
      ),
      beatsPerBar: accents.length,
      accents,
      sounds,
      countIn: { ...defaults.countIn, bars: countInBars },
    }),
    name: song.title,
    title: song.title,
    artist: song.artist,
  };
}

export function linkedPreset(runtime: SongPlayerRuntime, songId: number) {
  return runtime.records.forLibrarySong(songId).catch((error: unknown) => {
    console.warn('[kitbag] song preset unreadable', error);
    return undefined;
  });
}

type SongMeterState = Pick<
  SongPlayerState,
  'meterOverride' | 'detected' | 'clickSettings'
>;

function clickSettingsOf(
  preset: SongPreset,
  song: SongMeterState,
): SongClickSettings {
  return {
    countInBars: isCountInBars(preset.countInBars)
      ? preset.countInBars
      : song.clickSettings.countInBars,
    sounds: perAccentSoundsOf(preset.perAccentSounds, preset.sound),
    accents: resizeAccents(accentsOf(preset.accents), songMeter(song)),
    dirty: false,
  };
}

function savedClick(
  preset: SongPreset | undefined,
  song: SongMeterState,
): Partial<Pick<SongPlayerState, 'clickSettings'>> {
  return preset === undefined
    ? {}
    : { clickSettings: clickSettingsOf(preset, song) };
}

export interface LoadedSong extends Pick<
  SongPlayerState,
  'engineRate' | 'durationFrames'
> {
  readonly record: SongRecord;
  readonly preset: SongPreset | undefined;
}

export function readyState(
  { record, preset, engineRate, durationFrames }: LoadedSong,
  clickSettings: SongClickSettings,
): Partial<SongPlayerState> {
  const grid = recordGrid(record);
  const meterOverride = meterOverrideOf(record);
  const { detected } = grid;
  return {
    status: 'ready',
    engineRate,
    durationFrames,
    ...shownGrid(grid),
    detected,
    meterOverride,
    ...savedClick(preset, { meterOverride, detected, clickSettings }),
  };
}

interface SongPresetContext {
  readonly set: (change: Pick<SongPlayerState, 'clickSettings'>) => void;
  readonly get: () => SongPlayerState;
  readonly runtimeOf: () => SongPlayerRuntime;
  readonly session: () => number;
  readonly live: (opened: number) => boolean;
}

export function songPresetActions({
  set,
  get,
  runtimeOf,
  session,
  live,
}: SongPresetContext) {
  return {
    saveForSong: async () => {
      const song = get();
      if (song.songId === null || song.status !== 'ready') return;
      const opened = session();
      const saved = song.clickSettings;
      const values = presetOfSong(song);
      try {
        await runtimeOf().records.saveForLibrarySong(song.songId, values);
      } catch (error: unknown) {
        console.warn('[kitbag] song click not saved', error);
        return;
      }
      if (live(opened) && get().clickSettings === saved)
        set({ clickSettings: { ...saved, dirty: false } });
    },
  };
}

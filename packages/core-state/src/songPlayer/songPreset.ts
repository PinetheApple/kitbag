import type { LinkedPresetValues, SongPreset } from '@kitbag/core-db';
import { KB_BPM_BOUNDS } from '@kitbag/core-native';

import {
  accentsOf,
  perAccentSoundsOf,
  presetFromMetronome,
} from '../library/presetMapping.ts';
import { clamp, isCountInBars, resizeAccents } from '../metronome/config.ts';
import type { MetronomeConfig } from '../metronome/store.ts';
import type { SongPlayerRuntime } from './runtime.ts';
import {
  songMeter,
  type SongClickMetronome,
  type SongClickSettings,
} from './songClick.ts';
import type { SongPlayerState } from './state.ts';

type SavedSong = Pick<
  SongPlayerState,
  'title' | 'artist' | 'bpm' | 'clickSettings'
>;

export function presetOfSong(
  song: SavedSong,
  standalone: MetronomeConfig,
): LinkedPresetValues {
  const { countInBars, sounds, accents } = song.clickSettings;
  return {
    ...presetFromMetronome({
      ...standalone,
      beatsPerBar: accents.length,
      accents,
      sounds,
      countIn: { ...standalone.countIn, bars: countInBars },
    }),
    name: song.title,
    title: song.title,
    artist: song.artist,
    bpm: clamp(
      song.bpm ?? standalone.bpm,
      KB_BPM_BOUNDS.min,
      KB_BPM_BOUNDS.max,
    ),
    polyEnabled: false,
    rampEnabled: false,
    barMuteEnabled: false,
  };
}

type SongMeterState = Pick<
  SongPlayerState,
  'meterOverride' | 'detected' | 'clickSettings'
>;

export function clickSettingsOf(
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

interface SongPresetContext {
  readonly set: (change: Pick<SongPlayerState, 'clickSettings'>) => void;
  readonly get: () => SongPlayerState;
  readonly runtimeOf: () => SongPlayerRuntime;
  readonly metronome: SongClickMetronome;
  readonly session: () => number;
  readonly live: (opened: number) => boolean;
}

export function songPresetActions({
  set,
  get,
  runtimeOf,
  metronome,
  session,
  live,
}: SongPresetContext) {
  return {
    saveForSong: async () => {
      const song = get();
      if (song.songId === null || song.status !== 'ready') return;
      const opened = session();
      const saved = song.clickSettings;
      const values = presetOfSong(song, metronome.store.getState());
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

import type { MeterOverride } from '@kitbag/core-db';
import {
  KB_COUNT_IN_OFF,
  KB_DEFAULT_SOUNDS,
  type KB_ACCENT,
} from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import {
  defaultCommands,
  type MetronomeCommands,
} from '../metronome/commands.ts';
import {
  cycleAccentValue,
  isCountInBars,
  isSoundId,
  resizeAccents,
  type PerAccentSounds,
} from '../metronome/config.ts';
import {
  metronomeStore,
  type CountInBars,
  type MetronomeStore,
} from '../metronome/store.ts';
import type { DetectedMeter } from '../stemPlayer/meterOverride.ts';

export interface SongClickSettings {
  readonly countInBars: CountInBars;
  readonly sounds: PerAccentSounds;
  readonly accents: readonly KB_ACCENT[];
  readonly dirty: boolean;
}

export interface SongClickSlice {
  readonly songId: number | null;
  readonly click: boolean;
  readonly meterOverride: MeterOverride;
  readonly detected: DetectedMeter;
  readonly clickSettings: SongClickSettings;
}

export interface SongClickActions {
  readonly setClickSounds: (normal: number, accent: number) => void;
  readonly cycleClickAccent: (beat: number) => void;
  readonly setClickCountIn: (bars: number) => void;
}

export interface SongClickMetronome {
  readonly store: Pick<StoreApi<MetronomeStore>, 'getState'>;
  readonly commands: Pick<MetronomeCommands, 'setSounds' | 'setAccent'>;
}

export const standaloneMetronome: SongClickMetronome = {
  store: metronomeStore,
  commands: defaultCommands,
};

export const CLOSED_CLICK_SETTINGS: SongClickSettings = {
  countInBars: KB_COUNT_IN_OFF,
  sounds: KB_DEFAULT_SOUNDS,
  accents: [],
  dirty: false,
};

interface SongClickContext {
  readonly set: (change: Pick<SongClickSlice, 'clickSettings'>) => void;
  readonly get: () => SongClickSlice;
  readonly metronome: SongClickMetronome;
}

function songMeter({ meterOverride, detected }: SongClickSlice): number {
  return meterOverride.meterBeatsPerBar ?? detected.meter;
}

const sameSounds = (a: PerAccentSounds, b: PerAccentSounds) =>
  a.normal === b.normal && a.accent === b.accent;

export function songClickSettings({ set, get, metronome }: SongClickContext) {
  const { commands } = metronome;

  const change = (next: Partial<SongClickSettings>) => {
    set({ clickSettings: { ...get().clickSettings, ...next } });
  };

  const edit = (next: Partial<SongClickSettings>) => {
    change({ ...next, dirty: true });
  };

  const push = (sounds: PerAccentSounds, accents: readonly KB_ACCENT[]) => {
    commands.setSounds(sounds.normal, sounds.accent);
    accents.forEach((accent, beat) => {
      commands.setAccent(beat, accent);
    });
  };

  const restoreStandalone = () => {
    const { sounds, accents } = metronome.store.getState();
    push(sounds, accents);
  };

  const fitToMeter = (state: SongClickSlice) => {
    const accents = resizeAccents(
      state.clickSettings.accents,
      songMeter(state),
    );
    change({ accents });
    if (state.click) push(state.clickSettings.sounds, accents);
  };

  const actions: SongClickActions = {
    setClickSounds: (normal, accent) => {
      if (!isSoundId(normal) && !isSoundId(accent)) return;
      const prev = get().clickSettings.sounds;
      const sounds = {
        normal: isSoundId(normal) ? normal : prev.normal,
        accent: isSoundId(accent) ? accent : prev.accent,
      };
      if (sameSounds(sounds, prev)) return;
      edit({ sounds });
      if (get().click) commands.setSounds(sounds.normal, sounds.accent);
    },
    cycleClickAccent: (beat) => {
      const { accents } = get().clickSettings;
      const current = accents[beat];
      if (current === undefined) return;
      const next = cycleAccentValue(current);
      edit({ accents: accents.map((a, i) => (i === beat ? next : a)) });
      if (get().click) commands.setAccent(beat, next);
    },
    setClickCountIn: (bars) => {
      if (!isCountInBars(bars) || bars === get().clickSettings.countInBars)
        return;
      edit({ countInBars: bars });
    },
  };

  return {
    actions,
    seeded: (song: SongClickSlice): Pick<SongClickSlice, 'clickSettings'> => {
      const { countIn, sounds, accents } = metronome.store.getState();
      return {
        clickSettings: {
          countInBars: countIn.bars,
          sounds,
          accents: resizeAccents(accents, songMeter(song)),
          dirty: false,
        },
      };
    },
    clickStarting: () => {
      const { sounds, accents } = get().clickSettings;
      push(sounds, accents);
    },
    followSong: (state: SongClickSlice, previous: SongClickSlice) => {
      if (previous.click && !state.click) restoreStandalone();
      const meterChanged = songMeter(state) !== songMeter(previous);
      if (state.songId !== null && meterChanged) fitToMeter(state);
    },
  };
}

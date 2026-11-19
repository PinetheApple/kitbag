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
  type PerAccentSounds,
} from '../metronome/config.ts';
import {
  applyMetronomeSettings,
  standaloneMetronomeOf,
} from '../metronome/standalone.ts';
import {
  metronomeStore,
  type CountInBars,
  type MetronomeStore,
} from '../metronome/store.ts';

export interface SongClickSettings {
  readonly countInBars: CountInBars;
  readonly sounds: PerAccentSounds;
  readonly accents: readonly KB_ACCENT[];
  readonly dirty: boolean;
}

export interface SongClickSlice {
  readonly click: boolean;
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

export function songClickSettings({ set, get, metronome }: SongClickContext) {
  const { commands } = metronome;

  const edit = (change: Partial<SongClickSettings>) => {
    set({ clickSettings: { ...get().clickSettings, ...change, dirty: true } });
  };

  const pushSounds = ({ normal, accent }: PerAccentSounds) => {
    commands.setSounds(normal, accent);
  };

  const pushAccents = (accents: readonly KB_ACCENT[]) => {
    accents.forEach((accent, beat) => {
      commands.setAccent(beat, accent);
    });
  };

  const restoreStandalone = () => {
    const standalone = metronome.store.getState();
    applyMetronomeSettings(standalone, standaloneMetronomeOf(standalone));
  };

  const actions: SongClickActions = {
    setClickSounds: (normal, accent) => {
      if (!isSoundId(normal) && !isSoundId(accent)) return;
      const prev = get().clickSettings.sounds;
      const sounds = {
        normal: isSoundId(normal) ? normal : prev.normal,
        accent: isSoundId(accent) ? accent : prev.accent,
      };
      edit({ sounds });
      if (get().click) pushSounds(sounds);
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
      if (isCountInBars(bars)) edit({ countInBars: bars });
    },
  };

  return {
    actions,
    seeded: (): Pick<SongClickSlice, 'clickSettings'> => {
      const { countIn, sounds, accents } = metronome.store.getState();
      return {
        clickSettings: {
          countInBars: countIn.bars,
          sounds,
          accents,
          dirty: false,
        },
      };
    },
    clickStarting: () => {
      const { sounds, accents } = get().clickSettings;
      pushSounds(sounds);
      pushAccents(accents);
    },
    clickChanged: (state: SongClickSlice, previous: SongClickSlice) => {
      if (previous.click && !state.click) restoreStandalone();
    },
  };
}

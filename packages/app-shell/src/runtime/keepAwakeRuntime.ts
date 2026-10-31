import { getKitbagCommands, getKitbagHostObject } from '@kitbag/core-native';
import {
  getAppearanceStore,
  metronomeStore,
  stemPlayerStore,
  tunerStore,
} from '@kitbag/core-state';

// Configures the appearance store before getAppearanceStore() below reads it.
import './appearanceRuntime';
import { onAppForeground } from './appForeground';
import { wireKeepAwake } from './keepAwake.ts';

const MIXER_POLL_MS = 1000;

wireKeepAwake({
  metronome: metronomeStore,
  tuner: tunerStore,
  stemPlayer: stemPlayerStore,
  appearance: getAppearanceStore(),
  mixerPlaying: () => getKitbagHostObject().mixer_playing !== 0,
  poll: (tick) => {
    const timer = setInterval(tick, MIXER_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  },
  onForeground: onAppForeground,
  setKeepScreenOn: (on) => {
    getKitbagCommands().setKeepScreenOn(on);
  },
});

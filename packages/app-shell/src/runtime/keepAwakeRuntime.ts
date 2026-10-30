import { getKitbagCommands, getKitbagHostObject } from '@kitbag/core-native';
import {
  metronomeStore,
  stemPlayerStore,
  tunerStore,
} from '@kitbag/core-state';
import { AppState } from 'react-native';

import { wireKeepAwake } from './keepAwake.ts';

const MIXER_POLL_MS = 1000;

wireKeepAwake({
  metronome: metronomeStore,
  tuner: tunerStore,
  stemPlayer: stemPlayerStore,
  mixerPlaying: () => getKitbagHostObject().mixer_playing !== 0,
  poll: (tick) => {
    const timer = setInterval(tick, MIXER_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  },
  onForeground: (listener) => {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') listener();
    });
  },
  setKeepScreenOn: (on) => {
    getKitbagCommands().setKeepScreenOn(on);
  },
});

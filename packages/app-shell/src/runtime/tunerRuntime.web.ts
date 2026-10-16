import { KB_RESULT } from '@kitbag/core-native';
import {
  configureTunerRuntime,
  configureTunings,
  type AppActivitySource,
  type TunerCommands,
} from '@kitbag/core-state';

import { createMemoryTunings } from './memoryTunings.ts';

// The web build has no capture path, so starting the mic reports the engine's
// device-init failure and the screen shows its "couldn't start" state, rather
// than pretending to listen. Setters succeed so the pegs, tuning picker and A4
// sheet stay usable for layout work.
const commands: TunerCommands = {
  tunerStart: () => Promise.resolve(KB_RESULT.KB_ERROR_DEVICE_INIT_FAILED),
  tunerStop: () => undefined,
  tunerSetTuning: () => Promise.resolve(KB_RESULT.KB_OK),
  tunerSetTargetString: () => Promise.resolve(KB_RESULT.KB_OK),
  tunerSetChromatic: () => Promise.resolve(KB_RESULT.KB_OK),
  tunerSetA4: () => Promise.resolve(KB_RESULT.KB_OK),
  tunerResetNotePresence: () => Promise.resolve(KB_RESULT.KB_OK),
};

// A hidden tab stands in for the app going to the background.
const appActivity: AppActivitySource = {
  subscribe: (listener) => {
    const onChange = () => {
      listener(
        globalThis.document.visibilityState === 'hidden'
          ? 'background'
          : 'active',
      );
    };
    globalThis.document.addEventListener('visibilitychange', onChange);
    return () => {
      globalThis.document.removeEventListener('visibilitychange', onChange);
    };
  },
};

// Nothing to grant on web; the start that follows fails as described above.
configureTunerRuntime({
  commands,
  micPermission: {
    check: () => Promise.resolve('granted'),
    request: () => Promise.resolve('granted'),
  },
  appActivity,
});
configureTunings(createMemoryTunings(globalThis.localStorage));

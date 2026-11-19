import type * as Native from './clickSound.ts';

const NEEDS_APP = 'Custom click sounds need the Android app';

export const prepareClickSound: typeof Native.prepareClickSound = () =>
  Promise.reject(new Error(NEEDS_APP));

export const loadCustomSound: typeof Native.loadCustomSound = () =>
  Promise.reject(new Error(NEEDS_APP));

export const clearCustomSound: typeof Native.clearCustomSound = () => undefined;

export const customSoundLoaded: typeof Native.customSoundLoaded = () =>
  Promise.resolve(false);

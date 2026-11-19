import type * as Native from './clickSound.ts';

const NEEDS_APP = 'Custom click sounds need the Android app';

export const prepareClickSound: typeof Native.prepareClickSound = () =>
  Promise.reject(new Error(NEEDS_APP));

export const loadCustomSound: typeof Native.loadCustomSound = () =>
  Promise.reject(new Error(NEEDS_APP));

export const clearCustomSound: typeof Native.clearCustomSound = () => undefined;

export const customSoundLoaded: typeof Native.customSoundLoaded = () =>
  Promise.resolve(false);

export const readClickSound: typeof Native.readClickSound = () =>
  Promise.reject(new Error(NEEDS_APP));

export const writeClickSound: typeof Native.writeClickSound = () =>
  Promise.reject(new Error(NEEDS_APP));

export const deleteClickSound: typeof Native.deleteClickSound = () =>
  Promise.reject(new Error(NEEDS_APP));

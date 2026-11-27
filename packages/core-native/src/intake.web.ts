import type * as Native from './intake.ts';

export const takeInitialIntake: typeof Native.takeInitialIntake = () =>
  Promise.resolve([]);

export const watchIntake: typeof Native.watchIntake = () => () => undefined;

export const readSharedBackup: typeof Native.readSharedBackup = () =>
  Promise.reject(new Error('Opening a shared backup needs the Android app'));

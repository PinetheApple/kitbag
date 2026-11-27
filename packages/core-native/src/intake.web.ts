import type * as Native from './intake.ts';

export const takeLaunchIntake: typeof Native.takeLaunchIntake = () =>
  Promise.resolve([]);

export const watchIntake: typeof Native.watchIntake = () => () => undefined;

export const readSharedBackup: typeof Native.readSharedBackup = () =>
  Promise.reject(new Error('Opening a shared backup needs the Android app'));

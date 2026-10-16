// Platform handles the tuner store needs. core-state cannot import AppState or
// PermissionsAndroid (no react-native dependency here), so app-shell supplies
// them along with the commands. Unlike the metronome there is no native
// fallback: a tuner without lifecycle or permission wiring would capture in the
// background or never ask, so an unconfigured runtime throws on first use.

import type { TuningRepository } from '@kitbag/core-db';

import type { TunerCommands } from './commands.ts';

export type MicPermission = 'granted' | 'denied' | 'blocked';

export interface MicPermissionSource {
  /** Current answer without prompting. */
  readonly check: () => Promise<MicPermission>;
  /** Prompt if the platform still allows it; `blocked` = never ask again. */
  readonly request: () => Promise<MicPermission>;
}

/** App-level foreground state. Forward RN's `active` and `background` only. */
export type AppActivity = 'active' | 'background';

export interface AppActivitySource {
  readonly subscribe: (listener: (activity: AppActivity) => void) => () => void;
}

export interface TunerRuntime {
  readonly commands: TunerCommands;
  readonly micPermission: MicPermissionSource;
  readonly appActivity: AppActivitySource;
}

let configuredRuntime: TunerRuntime | undefined;
let configuredTunings: TuningRepository | undefined;

export function configureTunerRuntime(runtime: TunerRuntime): void {
  if (configuredRuntime === undefined) {
    configuredRuntime = runtime;
    return;
  }
  if (configuredRuntime !== runtime) {
    throw new Error('Tuner runtime is already configured');
  }
}

export function getTunerRuntime(): TunerRuntime {
  if (configuredRuntime === undefined) {
    throw new Error(
      'Tuner runtime is not configured; call configureTunerRuntime first',
    );
  }
  return configuredRuntime;
}

/** Install the custom-tunings repository (the app's one database handle). */
export function configureTunings(repository: TuningRepository): void {
  if (configuredTunings === undefined) {
    configuredTunings = repository;
    return;
  }
  if (configuredTunings !== repository) {
    throw new Error('Tunings repository is already configured');
  }
}

export function getTunings(): TuningRepository {
  if (configuredTunings === undefined) {
    throw new Error('Tunings repository is not configured');
  }
  return configuredTunings;
}

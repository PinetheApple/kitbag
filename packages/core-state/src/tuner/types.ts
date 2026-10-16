import type { NewTuning, Tuning } from '@kitbag/core-db';

import type { TunerCommands } from './commands.ts';
import type { MicPermission } from './runtime.ts';

export type TunerMode =
  | { readonly kind: 'auto' }
  | { readonly kind: 'manual'; readonly string: number }
  | { readonly kind: 'chromatic' };

export interface TunerTuning {
  readonly name: string;
  /** A KB_TUNER_INSTRUMENT value; selects the engine's in-tune windows. */
  readonly instrument: number;
  /** MIDI notes, low string first. */
  readonly notes: readonly number[];
  /** Set when the tuning is a saved custom tuning. */
  readonly customId?: number;
}

/** A saved custom tuning row. */
export type CustomTuning = Tuning;

/** `unavailable`: the capture device failed to open or start. */
export type MicStatus = 'off' | 'starting' | 'listening' | 'unavailable';

export interface TunerCommandError {
  readonly command: keyof TunerCommands;
  /** The kb_result, or `rejected` when the native call threw. */
  readonly result: number | 'rejected';
}

export interface TunerState {
  readonly open: boolean;
  readonly mode: TunerMode;
  readonly tuning: TunerTuning | null;
  /** null until the user picks one: the engine's default A4 is in force. */
  readonly a4Hz: number | null;
  /** String indices tuned since the screen was entered, ascending. */
  readonly tunedStrings: readonly number[];
  readonly permission: MicPermission | 'unknown';
  readonly mic: MicStatus;
  readonly customTunings: readonly CustomTuning[];
  readonly commandError: TunerCommandError | null;
}

export interface CustomTuningActions {
  loadCustomTunings: () => Promise<void>;
  createCustomTuning: (values: NewTuning) => Promise<CustomTuning>;
  updateCustomTuning: (id: number, values: Partial<NewTuning>) => Promise<void>;
  deleteCustomTuning: (id: number) => Promise<void>;
}

export interface TunerActions extends CustomTuningActions {
  /** Screen focus. Uses the session's tuning, or `defaultTuning` if none yet. */
  enter: (defaultTuning: TunerTuning) => void;
  /** Screen blur. */
  leave: () => void;
  /** Ask for the mic again (after a denial or a device failure). */
  retryMic: () => void;
  setAuto: () => void;
  lockString: (stringIndex: number) => void;
  setChromatic: () => void;
  /** Install a tuning. Like the engine, this returns to auto mode. */
  setTuning: (tuning: TunerTuning) => void;
  setA4: (hz: number) => void;
  /** Record an in-tune lock. True only the first time for a string. */
  markTuned: (stringIndex: number) => boolean;
}

export type TunerStore = TunerState & TunerActions;

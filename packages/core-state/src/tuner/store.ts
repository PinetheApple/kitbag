// Tuner store (SPEC §10.2, §13.4). Human-speed state only: the mode, the
// tuning, A4, which strings have been tuned this visit, permission and mic
// status. The needle, cents, detected string and in-tune ratio are polled from
// the HostObject by a worklet (§13.3) and never enter this store; the worklet
// reports a lock through markTuned, once per string.
//
// It also owns the mic lifecycle: enter pushes the config with the mic off,
// resets note presence and starts capture; leave and backgrounding stop it.

import type { NewTuning, Tuning, TuningRepository } from '@kitbag/core-db';
import {
  KB_RESULT,
  KB_TUNER_AUTO_STRING,
  KB_TUNER_INSTRUMENT,
  KB_TUNER_MAX_STRINGS,
} from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  createCommandQueue,
  nextTick,
  sendWithBusyRetry,
  type TunerCommands,
  type Wait,
} from './commands.ts';
import {
  getTunerRuntime,
  getTunings,
  type AppActivity,
  type MicPermission,
  type TunerRuntime,
} from './runtime.ts';

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
  readonly customTunings: readonly Tuning[];
  readonly commandError: TunerCommandError | null;
}

export interface TunerActions {
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
  loadCustomTunings: () => Promise<void>;
  createCustomTuning: (values: NewTuning) => Promise<Tuning>;
  updateCustomTuning: (id: number, values: Partial<NewTuning>) => Promise<void>;
  deleteCustomTuning: (id: number) => Promise<void>;
}

export type TunerStore = TunerState & TunerActions;

const AUTO: TunerMode = { kind: 'auto' };
const VALID_INSTRUMENTS = new Set<number>(Object.values(KB_TUNER_INSTRUMENT));

function isValidTuning(tuning: TunerTuning): boolean {
  return (
    tuning.notes.length >= 1 &&
    tuning.notes.length <= KB_TUNER_MAX_STRINGS &&
    tuning.notes.every((note) => Number.isInteger(note)) &&
    VALID_INSTRUMENTS.has(tuning.instrument)
  );
}

function hasString(tuning: TunerTuning | null, index: number): boolean {
  return (
    tuning !== null &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < tuning.notes.length
  );
}

export function tuningFromCustom(row: Tuning): TunerTuning {
  return {
    name: row.name,
    instrument: row.instrument,
    notes: row.notes,
    customId: row.id,
  };
}

/** Every string of the current tuning has been tuned this visit. */
export function allStringsTuned(state: TunerState): boolean {
  return (
    state.mode.kind !== 'chromatic' &&
    state.tuning !== null &&
    state.tunedStrings.length === state.tuning.notes.length
  );
}

export interface TunerStoreDeps {
  readonly runtime?: () => TunerRuntime;
  readonly tunings?: () => TuningRepository;
  readonly wait?: Wait;
}

export function createTunerStore(
  deps: TunerStoreDeps = {},
): StoreApi<TunerStore> {
  const runtime = deps.runtime ?? getTunerRuntime;
  const tunings = deps.tunings ?? getTunings;
  const wait = deps.wait ?? nextTick;
  const queue = createCommandQueue();

  // Bumped by every lifecycle transition; async steps from an older epoch stop.
  let epoch = 0;
  let appActive = true;
  // Engine truth as far as this store's own commands go: a stop is sent only
  // after a start that succeeded.
  let capturing = false;
  let unsubscribe: (() => void) | undefined;

  return createStore<TunerStore>((set, get) => {
    const recordFailure = (
      command: keyof TunerCommands,
      result: number | 'rejected',
    ) => {
      set({ commandError: { command, result } });
    };

    // Enqueue a kb_result-returning setter with BUSY retry.
    const sendSetter = (
      command: keyof TunerCommands,
      send: (commands: TunerCommands) => Promise<number>,
    ): Promise<void> =>
      queue.run(async () => {
        try {
          const result = await sendWithBusyRetry(
            () => send(runtime().commands),
            wait,
          );
          if (result === KB_RESULT.KB_OK) set({ commandError: null });
          else recordFailure(command, result);
        } catch {
          recordFailure(command, 'rejected');
        }
      });

    const sendMode = (mode: TunerMode) => {
      if (mode.kind === 'chromatic') {
        void sendSetter('tunerSetChromatic', (c) => c.tunerSetChromatic());
        return;
      }
      const target =
        mode.kind === 'manual' ? mode.string : KB_TUNER_AUTO_STRING;
      void sendSetter('tunerSetTargetString', (c) =>
        c.tunerSetTargetString(target),
      );
    };

    const sendTuning = (tuning: TunerTuning) => {
      void sendSetter('tunerSetTuning', (c) =>
        c.tunerSetTuning(tuning.instrument, tuning.notes),
      );
    };

    // Full config in engine order: set_tuning selects auto, so mode goes last.
    const pushConfig = () => {
      const { tuning, a4Hz, mode } = get();
      if (tuning !== null) sendTuning(tuning);
      if (a4Hz !== null) {
        void sendSetter('tunerSetA4', (c) => c.tunerSetA4(a4Hz));
      }
      sendMode(mode);
    };

    const stopCapture = () => {
      void queue.run(() => {
        if (capturing) {
          capturing = false;
          try {
            runtime().commands.tunerStop();
          } catch {
            recordFailure('tunerStop', 'rejected');
          }
        }
        return Promise.resolve();
      });
    };

    const isCurrent = (expected: number) =>
      expected === epoch && get().open && appActive;

    const startCapture = async (expected: number, ask: boolean) => {
      let permission: MicPermission;
      try {
        const source = runtime().micPermission;
        permission = await (ask ? source.request() : source.check());
      } catch {
        permission = 'denied';
      }
      if (!isCurrent(expected)) return;
      set({ permission });
      if (permission !== 'granted') {
        set({ mic: 'off' });
        return;
      }
      set({ mic: 'starting' });
      // With the mic off these apply at once; after a foreground they may meet
      // a running mic and go through the BUSY retry instead.
      pushConfig();
      void sendSetter('tunerResetNotePresence', (c) =>
        c.tunerResetNotePresence(0),
      );
      await queue.run(async () => {
        if (!isCurrent(expected)) return;
        if (capturing) {
          set({ mic: 'listening' });
          return;
        }
        let result: number | 'rejected';
        try {
          result = await runtime().commands.tunerStart();
        } catch {
          result = 'rejected';
        }
        if (result === KB_RESULT.KB_OK) capturing = true;
        else recordFailure('tunerStart', result);
        // A leave or background that landed during the await has already
        // queued its stop behind this task, so only the status is guarded.
        if (!isCurrent(expected)) return;
        set({ mic: result === KB_RESULT.KB_OK ? 'listening' : 'unavailable' });
      });
    };

    const onActivity = (activity: AppActivity) => {
      const active = activity === 'active';
      if (active === appActive) return;
      appActive = active;
      if (!get().open) return;
      epoch++;
      if (active) {
        void startCapture(epoch, false);
      } else {
        set({ mic: 'off' });
        stopCapture();
      }
    };

    return {
      open: false,
      mode: AUTO,
      tuning: null,
      a4Hz: null,
      tunedStrings: [],
      permission: 'unknown',
      mic: 'off',
      customTunings: [],
      commandError: null,

      enter: (defaultTuning) => {
        if (get().open) return;
        unsubscribe = runtime().appActivity.subscribe(onActivity);
        epoch++;
        const tuning = get().tuning ?? defaultTuning;
        // SPEC §10.2: no in-tune state survives leaving and coming back.
        set({
          open: true,
          mode: AUTO,
          tunedStrings: [],
          tuning,
          mic: 'off',
          commandError: null,
        });
        void startCapture(epoch, true);
      },

      leave: () => {
        if (!get().open) return;
        epoch++;
        unsubscribe?.();
        unsubscribe = undefined;
        appActive = true;
        set({ open: false, mic: 'off' });
        stopCapture();
      },

      retryMic: () => {
        if (!get().open || !appActive) return;
        epoch++;
        void startCapture(epoch, true);
      },

      setAuto: () => {
        set({ mode: AUTO });
        if (get().open) sendMode(AUTO);
      },

      lockString: (stringIndex) => {
        if (!hasString(get().tuning, stringIndex)) return;
        const mode: TunerMode = { kind: 'manual', string: stringIndex };
        set({ mode });
        if (get().open) sendMode(mode);
      },

      setChromatic: () => {
        const mode: TunerMode = { kind: 'chromatic' };
        set({ mode });
        if (get().open) sendMode(mode);
      },

      setTuning: (tuning) => {
        if (!isValidTuning(tuning)) return;
        set({ tuning, mode: AUTO, tunedStrings: [] });
        if (get().open) sendTuning(tuning);
      },

      setA4: (hz) => {
        if (!Number.isFinite(hz) || hz <= 0) return;
        set({ a4Hz: hz });
        if (get().open) {
          void sendSetter('tunerSetA4', (c) => c.tunerSetA4(hz));
        }
      },

      markTuned: (stringIndex) => {
        const { mode, tuning, tunedStrings } = get();
        if (mode.kind === 'chromatic') return false;
        if (!hasString(tuning, stringIndex)) return false;
        if (tunedStrings.includes(stringIndex)) return false;
        set({
          tunedStrings: [...tunedStrings, stringIndex].sort((a, b) => a - b),
        });
        return true;
      },

      loadCustomTunings: async () => {
        const rows = await tunings().list();
        set({ customTunings: rows });
      },

      createCustomTuning: async (values) => {
        const row = await tunings().create(values);
        set((s) => ({ customTunings: [...s.customTunings, row] }));
        return row;
      },

      updateCustomTuning: async (id, values) => {
        await tunings().update(id, values);
        const previous = get().customTunings.find((row) => row.id === id);
        if (previous === undefined) return;
        const updated: Tuning = { ...previous, ...values };
        set((s) => ({
          customTunings: s.customTunings.map((row) =>
            row.id === id ? updated : row,
          ),
        }));
        if (get().tuning?.customId === id) {
          get().setTuning(tuningFromCustom(updated));
        }
      },

      deleteCustomTuning: async (id) => {
        await tunings().delete(id);
        set((s) => ({
          customTunings: s.customTunings.filter((row) => row.id !== id),
        }));
        // The notes stay selected for this visit; only the link to the
        // deleted row goes.
        const current = get().tuning;
        if (current?.customId === id) {
          set({
            tuning: {
              name: current.name,
              instrument: current.instrument,
              notes: current.notes,
            },
          });
        }
      },
    };
  });
}

/** Default singleton; resolves the configured runtime and repository lazily. */
export const tunerStore = createTunerStore();

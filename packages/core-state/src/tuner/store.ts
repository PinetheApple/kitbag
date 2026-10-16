// Human-speed tuner state only (§13.3): needle, cents, detected string and
// in-tune ratio are polled from the HostObject in a worklet, never stored here.

import type { TuningRepository } from '@kitbag/core-db';
import { KB_RESULT, KB_TUNER_AUTO_STRING } from '@kitbag/core-native';
import { createStore, type StoreApi } from 'zustand/vanilla';

import {
  busyRetryDelay,
  createCommandQueue,
  sendWithBusyRetry,
  type TunerCommands,
  type Wait,
} from './commands.ts';
import { customTuningActions, isValidTuning } from './customTunings.ts';
import {
  getTunerRuntime,
  getTunings,
  type AppActivity,
  type MicPermission,
  type TunerRuntime,
} from './runtime.ts';
import type {
  TunerMode,
  TunerState,
  TunerStore,
  TunerTuning,
} from './types.ts';

const AUTO: TunerMode = { kind: 'auto' };

function hasString(tuning: TunerTuning | null, index: number): boolean {
  return (
    tuning !== null &&
    Number.isInteger(index) &&
    index >= 0 &&
    index < tuning.notes.length
  );
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
  const wait = deps.wait ?? busyRetryDelay;
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

      ...customTuningActions(set, get, tunings),
    };
  });
}

/** Default singleton; resolves the configured runtime and repository lazily. */
export const tunerStore = createTunerStore();

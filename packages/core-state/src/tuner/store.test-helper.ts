import type { NewTuning, Tuning, TuningRepository } from '@kitbag/core-db';
import { KB_RESULT, KB_TUNER_INSTRUMENT } from '@kitbag/core-native';
import { vi } from 'vitest';

import type { TunerCommands } from './commands.ts';
import type { AppActivity, MicPermission, TunerRuntime } from './runtime.ts';
import { createTunerStore } from './store.ts';
import type { TunerStore, TunerTuning } from './types.ts';

export const GUITAR: TunerTuning = {
  name: 'Standard',
  instrument: KB_TUNER_INSTRUMENT.KB_TUNER_INSTRUMENT_GUITAR,
  notes: [40, 45, 50, 55, 59, 64],
};
export const DROP_D: TunerTuning = {
  ...GUITAR,
  name: 'Drop D',
  notes: [38, 45, 50, 55, 59, 64],
};

export const OK = KB_RESULT.KB_OK;
export const BUSY = KB_RESULT.KB_ERROR_BUSY;

type Call = readonly [keyof TunerCommands, ...unknown[]];

export function makeFakes() {
  const calls: Call[] = [];
  // Per-command result scripts; empty means KB_OK.
  const scripts = new Map<keyof TunerCommands, number[]>();
  const result = (name: keyof TunerCommands) =>
    scripts.get(name)?.shift() ?? OK;
  const record =
    (name: keyof TunerCommands) =>
    (...args: unknown[]): Promise<number> => {
      calls.push([name, ...args]);
      return Promise.resolve(result(name));
    };
  const commands: TunerCommands = {
    tunerStart: record('tunerStart'),
    tunerStop: (...args: unknown[]) => {
      calls.push(['tunerStop', ...args]);
    },
    tunerSetTuning: record('tunerSetTuning'),
    tunerSetTargetString: record('tunerSetTargetString'),
    tunerSetChromatic: record('tunerSetChromatic'),
    tunerSetA4: record('tunerSetA4'),
    tunerResetNotePresence: record('tunerResetNotePresence'),
  };

  let permission: MicPermission = 'granted';
  const micPermission = {
    check: vi.fn(() => Promise.resolve(permission)),
    request: vi.fn(() => Promise.resolve(permission)),
  };

  let listener: ((a: AppActivity) => void) | undefined;
  const appActivity = {
    subscribe: vi.fn((l: (a: AppActivity) => void) => {
      listener = l;
      return () => {
        listener = undefined;
      };
    }),
  };

  const runtime: TunerRuntime = { commands, micPermission, appActivity };
  return {
    calls,
    names: () => calls.map((c) => c[0]),
    script: (name: keyof TunerCommands, results: number[]) => {
      scripts.set(name, results);
    },
    setPermission: (p: MicPermission) => {
      permission = p;
    },
    emit: (a: AppActivity) => listener?.(a),
    hasListener: () => listener !== undefined,
    micPermission,
    runtime,
  };
}

export function makeRepo() {
  let nextId = 1;
  const rows: Tuning[] = [];
  const spies = {
    list: vi.fn(() => Promise.resolve(rows.map((r) => ({ ...r })))),
    create: vi.fn((values: NewTuning) => {
      const row = { ...values, id: nextId, uuid: `u${String(nextId)}` };
      nextId++;
      rows.push(row);
      return Promise.resolve({ ...row });
    }),
    update: vi.fn((id: number, values: Partial<NewTuning>) => {
      const i = rows.findIndex((r) => r.id === id);
      const row = rows[i];
      if (row !== undefined) rows[i] = { ...row, ...values };
      return Promise.resolve();
    }),
    delete: vi.fn((id: number) => {
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
      return Promise.resolve();
    }),
  };
  const repository: TuningRepository = spies;
  return { rows, spies, repository };
}

// Drain every pending promise and queued task. The fakes resolve immediately
// and `wait` is a resolved promise, so a few macrotask turns settle everything.
export async function settle() {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

export interface Harness {
  readonly fakes: ReturnType<typeof makeFakes>;
  readonly repo: ReturnType<typeof makeRepo>;
  readonly store: ReturnType<typeof createTunerStore>;
  readonly wait: ReturnType<typeof vi.fn<() => Promise<void>>>;
  readonly s: () => TunerStore;
}

export function createHarness(): Harness {
  const fakes = makeFakes();
  const repo = makeRepo();
  const wait = vi.fn(() => Promise.resolve());
  const store = createTunerStore({
    runtime: () => fakes.runtime,
    tunings: () => repo.repository,
    wait,
  });
  return { fakes, repo, store, wait, s: () => store.getState() };
}

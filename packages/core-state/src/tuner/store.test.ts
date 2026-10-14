import type { NewTuning, Tuning, TuningRepository } from '@kitbag/core-db';
import {
  KB_RESULT,
  KB_TUNER_AUTO_STRING,
  KB_TUNER_INSTRUMENT,
  KB_TUNER_MAX_STRINGS,
} from '@kitbag/core-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MAX_BUSY_RETRIES, type TunerCommands } from './commands.ts';
import type { AppActivity, MicPermission, TunerRuntime } from './runtime.ts';
import {
  allStringsTuned,
  createTunerStore,
  type TunerStore,
  type TunerTuning,
} from './store.ts';

const GUITAR: TunerTuning = {
  name: 'Standard',
  instrument: KB_TUNER_INSTRUMENT.KB_TUNER_INSTRUMENT_GUITAR,
  notes: [40, 45, 50, 55, 59, 64],
};
const DROP_D: TunerTuning = {
  ...GUITAR,
  name: 'Drop D',
  notes: [38, 45, 50, 55, 59, 64],
};

const OK = KB_RESULT.KB_OK;
const BUSY = KB_RESULT.KB_ERROR_BUSY;

type Call = readonly [keyof TunerCommands, ...unknown[]];

function makeFakes() {
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

function makeRepo() {
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
async function settle() {
  for (let i = 0; i < 5; i++) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }
}

let fakes: ReturnType<typeof makeFakes>;
let repo: ReturnType<typeof makeRepo>;
let store: ReturnType<typeof createTunerStore>;
let wait: ReturnType<typeof vi.fn<() => Promise<void>>>;
const s = (): TunerStore => store.getState();

beforeEach(() => {
  fakes = makeFakes();
  repo = makeRepo();
  wait = vi.fn(() => Promise.resolve());
  store = createTunerStore({
    runtime: () => fakes.runtime,
    tunings: () => repo.repository,
    wait,
  });
});

describe('§13.3 no realtime values in the store', () => {
  it('holds no field that shadows a HostObject poll', () => {
    const keys = Object.keys(s());
    for (const banned of [
      'cents',
      'needle',
      'currentString',
      'inTuneRatio',
      'measuredMidi',
      'canHearNote',
      'snapshot',
    ]) {
      expect(keys).not.toContain(banned);
    }
  });
});

describe('enter', () => {
  it('pushes config with the mic off, resets note presence, then starts', async () => {
    s().setA4(442);
    s().enter(GUITAR);
    await settle();

    expect(fakes.calls).toEqual([
      ['tunerSetTuning', GUITAR.instrument, GUITAR.notes],
      ['tunerSetA4', 442],
      ['tunerSetTargetString', KB_TUNER_AUTO_STRING],
      ['tunerResetNotePresence', 0],
      ['tunerStart'],
    ]);
    expect(s().mic).toBe('listening');
    expect(s().permission).toBe('granted');
    expect(fakes.micPermission.request).toHaveBeenCalledTimes(1);
  });

  it('leaves A4 to the engine default until the user sets one', async () => {
    s().enter(GUITAR);
    await settle();
    expect(fakes.names()).not.toContain('tunerSetA4');
    expect(s().a4Hz).toBeNull();
  });

  it('keeps the session tuning over the default on re-entry', async () => {
    s().enter(GUITAR);
    s().setTuning(DROP_D);
    s().leave();
    s().enter(GUITAR);
    await settle();
    expect(s().tuning).toEqual(DROP_D);
  });

  it('is a no-op when already open', async () => {
    s().enter(GUITAR);
    await settle();
    const before = fakes.calls.length;
    s().enter(GUITAR);
    await settle();
    expect(fakes.calls.length).toBe(before);
  });

  it('throws without opening when the runtime is unconfigured', () => {
    const bare = createTunerStore({
      runtime: () => {
        throw new Error('not configured');
      },
    });
    expect(() => {
      bare.getState().enter(GUITAR);
    }).toThrow('not configured');
    expect(bare.getState().open).toBe(false);
  });
});

describe('§10.2 reset on re-entry', () => {
  it('re-entering returns to auto, clears tuned strings and resets presence', async () => {
    s().enter(GUITAR);
    await settle();
    s().lockString(2);
    expect(s().markTuned(2)).toBe(true);
    s().leave();
    await settle();
    fakes.calls.length = 0;

    s().enter(GUITAR);
    expect(s().mode).toEqual({ kind: 'auto' });
    expect(s().tunedStrings).toEqual([]);
    await settle();
    expect(fakes.calls).toContainEqual([
      'tunerSetTargetString',
      KB_TUNER_AUTO_STRING,
    ]);
    expect(fakes.calls).toContainEqual(['tunerResetNotePresence', 0]);
  });
});

describe('leave', () => {
  it('stops capture after a successful start', async () => {
    s().enter(GUITAR);
    await settle();
    s().leave();
    await settle();
    expect(fakes.names().at(-1)).toBe('tunerStop');
    expect(s().open).toBe(false);
    expect(s().mic).toBe('off');
    expect(fakes.hasListener()).toBe(false);
  });

  it('never starts when leaving before the permission answer lands', async () => {
    let answer: (p: MicPermission) => void = () => undefined;
    fakes.micPermission.request.mockImplementationOnce(
      () =>
        new Promise<MicPermission>((resolve) => {
          answer = resolve;
        }),
    );
    s().enter(GUITAR);
    s().leave();
    answer('granted');
    await settle();
    expect(fakes.names()).not.toContain('tunerStart');
    expect(fakes.names()).not.toContain('tunerStop');
  });

  it('stops even when leave lands while start is in flight', async () => {
    let finishStart: (r: number) => void = () => undefined;
    fakes.runtime.commands.tunerStart = () =>
      new Promise<number>((resolve) => {
        fakes.calls.push(['tunerStart']);
        finishStart = resolve;
      });
    s().enter(GUITAR);
    await settle();
    s().leave();
    finishStart(OK);
    await settle();
    expect(fakes.names().slice(-2)).toEqual(['tunerStart', 'tunerStop']);
    expect(s().mic).toBe('off');
  });
});

describe('serialisation', () => {
  it('does not send a command until the one before it settles', async () => {
    const pending: ((r: number) => void)[] = [];
    fakes.runtime.commands.tunerSetTargetString = (index) =>
      new Promise<number>((resolve) => {
        fakes.calls.push(['tunerSetTargetString', index]);
        pending.push(resolve);
      });
    s().enter(GUITAR);
    await settle();
    // Stuck on the auto target from enter: nothing after it has gone out.
    expect(fakes.names()).toEqual(['tunerSetTuning', 'tunerSetTargetString']);

    s().setChromatic();
    pending.shift()?.(OK);
    await settle();
    expect(fakes.names()).toEqual([
      'tunerSetTuning',
      'tunerSetTargetString',
      'tunerResetNotePresence',
      'tunerStart',
      'tunerSetChromatic',
    ]);
  });

  it('keeps the queue moving after a native rejection', async () => {
    fakes.runtime.commands.tunerSetChromatic = () =>
      Promise.reject(new Error('boom'));
    s().enter(GUITAR);
    await settle();
    s().setChromatic();
    s().setAuto();
    await settle();
    expect(s().commandError).toBeNull();
    expect(fakes.names().at(-1)).toBe('tunerSetTargetString');
  });

  it('records a rejection that is not followed by a success', async () => {
    fakes.runtime.commands.tunerSetChromatic = () =>
      Promise.reject(new Error('boom'));
    s().enter(GUITAR);
    await settle();
    s().setChromatic();
    await settle();
    expect(s().commandError).toEqual({
      command: 'tunerSetChromatic',
      result: 'rejected',
    });
  });
});

describe('KB_ERROR_BUSY', () => {
  it('retries a busy setter and succeeds within the bound', async () => {
    s().enter(GUITAR);
    await settle();
    fakes.calls.length = 0;
    fakes.script('tunerSetTargetString', [BUSY, BUSY]);

    s().lockString(1);
    await settle();
    expect(fakes.calls).toEqual([
      ['tunerSetTargetString', 1],
      ['tunerSetTargetString', 1],
      ['tunerSetTargetString', 1],
    ]);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(s().commandError).toBeNull();
  });

  it('gives up after the bound and records the failure', async () => {
    s().enter(GUITAR);
    await settle();
    fakes.calls.length = 0;
    fakes.script('tunerSetA4', Array<number>(MAX_BUSY_RETRIES + 5).fill(BUSY));

    s().setA4(445);
    s().setChromatic();
    await settle();
    expect(fakes.names()).toEqual([
      ...Array<string>(MAX_BUSY_RETRIES + 1).fill('tunerSetA4'),
      'tunerSetChromatic',
    ]);
    // The later success clears the error the A4 failure set.
    expect(s().commandError).toBeNull();
  });

  it('leaves the error in place when the last command failed', async () => {
    s().enter(GUITAR);
    await settle();
    fakes.script('tunerSetA4', Array<number>(MAX_BUSY_RETRIES + 1).fill(BUSY));
    s().setA4(445);
    await settle();
    expect(s().commandError).toEqual({ command: 'tunerSetA4', result: BUSY });
  });

  it('does not retry a non-busy failure', async () => {
    s().enter(GUITAR);
    await settle();
    fakes.calls.length = 0;
    fakes.script('tunerSetTargetString', [KB_RESULT.KB_ERROR_INVALID_ARGUMENT]);
    s().lockString(0);
    await settle();
    expect(fakes.calls).toHaveLength(1);
    expect(s().commandError?.result).toBe(KB_RESULT.KB_ERROR_INVALID_ARGUMENT);
  });
});

describe('app background / foreground', () => {
  it('stops in the background and restarts in the foreground', async () => {
    s().enter(GUITAR);
    await settle();
    s().markTuned(0);
    fakes.calls.length = 0;

    fakes.emit('background');
    await settle();
    expect(fakes.names()).toEqual(['tunerStop']);
    expect(s().mic).toBe('off');

    fakes.calls.length = 0;
    fakes.emit('active');
    await settle();
    expect(fakes.names().at(-1)).toBe('tunerStart');
    expect(fakes.names()).toContain('tunerResetNotePresence');
    expect(s().mic).toBe('listening');
    // Coming back from the background is not a screen re-entry.
    expect(s().tunedStrings).toEqual([0]);
    // Foregrounding checks; it never prompts.
    expect(fakes.micPermission.check).toHaveBeenCalledTimes(1);
    expect(fakes.micPermission.request).toHaveBeenCalledTimes(1);
  });

  it('keeps a locked string across a background trip', async () => {
    s().enter(GUITAR);
    await settle();
    s().lockString(3);
    fakes.emit('background');
    fakes.emit('active');
    await settle();
    expect(fakes.calls.at(-3)).toEqual(['tunerSetTargetString', 3]);
  });

  it('does not start when backgrounded during the permission prompt', async () => {
    let answer: (p: MicPermission) => void = () => undefined;
    fakes.micPermission.request.mockImplementationOnce(
      () =>
        new Promise<MicPermission>((resolve) => {
          answer = resolve;
        }),
    );
    s().enter(GUITAR);
    fakes.emit('background');
    answer('granted');
    await settle();
    expect(fakes.names()).not.toContain('tunerStart');
  });

  it('ignores activity after the screen is left', async () => {
    s().enter(GUITAR);
    await settle();
    s().leave();
    await settle();
    fakes.calls.length = 0;
    fakes.emit('active');
    await settle();
    expect(fakes.calls).toEqual([]);
  });
});

describe('permission and device failure', () => {
  it('stays idle and usable when permission is denied', async () => {
    fakes.setPermission('blocked');
    s().enter(GUITAR);
    await settle();
    expect(s().permission).toBe('blocked');
    expect(s().mic).toBe('off');
    expect(fakes.names()).not.toContain('tunerStart');

    s().lockString(1);
    await settle();
    expect(s().mode).toEqual({ kind: 'manual', string: 1 });
  });

  it('retryMic asks again and starts once granted', async () => {
    fakes.setPermission('denied');
    s().enter(GUITAR);
    await settle();
    fakes.setPermission('granted');
    s().retryMic();
    await settle();
    expect(fakes.micPermission.request).toHaveBeenCalledTimes(2);
    expect(s().mic).toBe('listening');
  });

  it.each([
    KB_RESULT.KB_ERROR_DEVICE_INIT_FAILED,
    KB_RESULT.KB_ERROR_DEVICE_START_FAILED,
  ])('marks the mic unavailable when start returns %i', async (code) => {
    fakes.script('tunerStart', [code]);
    s().enter(GUITAR);
    await settle();
    expect(s().mic).toBe('unavailable');
    expect(s().commandError).toEqual({ command: 'tunerStart', result: code });

    s().leave();
    await settle();
    expect(fakes.names()).not.toContain('tunerStop');
  });

  it('recovers from a device failure on retry', async () => {
    fakes.script('tunerStart', [KB_RESULT.KB_ERROR_DEVICE_INIT_FAILED]);
    s().enter(GUITAR);
    await settle();
    s().retryMic();
    await settle();
    expect(s().mic).toBe('listening');
  });
});

describe('modes', () => {
  beforeEach(async () => {
    s().enter(GUITAR);
    await settle();
    fakes.calls.length = 0;
  });

  it('auto → manual → chromatic → auto sends one command each', async () => {
    s().lockString(4);
    expect(s().mode).toEqual({ kind: 'manual', string: 4 });
    s().setChromatic();
    expect(s().mode).toEqual({ kind: 'chromatic' });
    s().setAuto();
    expect(s().mode).toEqual({ kind: 'auto' });
    await settle();
    expect(fakes.calls).toEqual([
      ['tunerSetTargetString', 4],
      ['tunerSetChromatic'],
      ['tunerSetTargetString', KB_TUNER_AUTO_STRING],
    ]);
  });

  it('ignores a string the tuning does not have', async () => {
    s().lockString(GUITAR.notes.length);
    s().lockString(-1);
    s().lockString(1.5);
    await settle();
    expect(s().mode).toEqual({ kind: 'auto' });
    expect(fakes.calls).toEqual([]);
  });

  it('a new tuning returns to auto and clears tuned strings, like the engine', async () => {
    s().lockString(2);
    s().markTuned(2);
    s().setTuning(DROP_D);
    expect(s().mode).toEqual({ kind: 'auto' });
    expect(s().tunedStrings).toEqual([]);
    await settle();
    expect(fakes.calls.at(-1)).toEqual([
      'tunerSetTuning',
      DROP_D.instrument,
      DROP_D.notes,
    ]);
  });

  it('rejects a tuning the engine would refuse', async () => {
    s().setTuning({ ...GUITAR, notes: [] });
    s().setTuning({
      ...GUITAR,
      notes: Array<number>(KB_TUNER_MAX_STRINGS + 1).fill(40),
    });
    s().setTuning({ ...GUITAR, instrument: 99 });
    await settle();
    expect(s().tuning).toEqual(GUITAR);
    expect(fakes.calls).toEqual([]);
  });

  it('sends nothing while the screen is closed; enter pushes it all', async () => {
    s().leave();
    await settle();
    fakes.calls.length = 0;
    s().setA4(432);
    s().setChromatic();
    await settle();
    expect(fakes.calls).toEqual([]);
    s().enter(GUITAR);
    await settle();
    expect(fakes.calls).toContainEqual(['tunerSetA4', 432]);
  });
});

describe('markTuned', () => {
  beforeEach(async () => {
    s().enter(GUITAR);
    await settle();
  });

  it('marks a string tuned once', () => {
    expect(s().markTuned(3)).toBe(true);
    expect(s().markTuned(3)).toBe(false);
    expect(s().markTuned(1)).toBe(true);
    expect(s().tunedStrings).toEqual([1, 3]);
  });

  it('survives mode switches (only re-entry clears it)', () => {
    s().markTuned(0);
    s().lockString(1);
    s().setAuto();
    expect(s().tunedStrings).toEqual([0]);
  });

  it('ignores chromatic mode and unknown strings', () => {
    expect(s().markTuned(GUITAR.notes.length)).toBe(false);
    s().setChromatic();
    expect(s().markTuned(0)).toBe(false);
    expect(s().tunedStrings).toEqual([]);
  });

  it('reports all strings tuned', () => {
    GUITAR.notes.forEach((_, i) => {
      expect(allStringsTuned(s())).toBe(false);
      s().markTuned(i);
    });
    expect(allStringsTuned(s())).toBe(true);
  });
});

describe('custom tunings', () => {
  const OPEN_G: NewTuning = {
    name: 'Open G',
    instrument: KB_TUNER_INSTRUMENT.KB_TUNER_INSTRUMENT_GUITAR,
    notes: [38, 43, 50, 55, 59, 62],
  };

  it('creates, lists, updates and deletes through the repository', async () => {
    const created = await s().createCustomTuning(OPEN_G);
    expect(s().customTunings).toEqual([created]);

    await s().updateCustomTuning(created.id, { name: 'Open G (low)' });
    expect(repo.spies.update).toHaveBeenCalledWith(created.id, {
      name: 'Open G (low)',
    });
    expect(s().customTunings[0]?.name).toBe('Open G (low)');

    const fresh = createTunerStore({
      runtime: () => fakes.runtime,
      tunings: () => repo.repository,
    });
    await fresh.getState().loadCustomTunings();
    expect(fresh.getState().customTunings).toEqual(s().customTunings);

    await s().deleteCustomTuning(created.id);
    expect(s().customTunings).toEqual([]);
    expect(repo.rows).toEqual([]);
  });

  it('re-sends the selected custom tuning when it is edited', async () => {
    const created = await s().createCustomTuning(OPEN_G);
    s().enter({ ...OPEN_G, customId: created.id });
    await settle();
    fakes.calls.length = 0;

    const edited = [37, 43, 50, 55, 59, 62];
    await s().updateCustomTuning(created.id, { notes: edited });
    await settle();
    expect(s().tuning?.notes).toEqual(edited);
    expect(fakes.calls).toEqual([
      ['tunerSetTuning', OPEN_G.instrument, edited],
    ]);
  });

  it('keeps the notes but drops the link when the selected tuning is deleted', async () => {
    const created = await s().createCustomTuning(OPEN_G);
    s().setTuning({ ...OPEN_G, customId: created.id });
    await s().deleteCustomTuning(created.id);
    expect(s().tuning).toEqual(OPEN_G);
  });

  it('leaves the list unchanged when the repository refuses', async () => {
    repo.spies.create.mockRejectedValueOnce(new Error('invalid'));
    await expect(s().createCustomTuning(OPEN_G)).rejects.toThrow('invalid');
    expect(s().customTunings).toEqual([]);
  });
});

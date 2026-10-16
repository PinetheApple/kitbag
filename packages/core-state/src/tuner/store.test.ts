import { KB_RESULT, KB_TUNER_AUTO_STRING } from '@kitbag/core-native';
import { beforeEach, describe, expect, it } from 'vitest';

import { MAX_BUSY_RETRIES } from './commands.ts';
import type { MicPermission } from './runtime.ts';
import { createTunerStore } from './store.ts';
import {
  BUSY,
  createHarness,
  DROP_D,
  GUITAR,
  OK,
  settle,
  type Harness,
} from './store.test-helper.ts';

let fakes: Harness['fakes'];
let wait: Harness['wait'];
let s: Harness['s'];

beforeEach(() => {
  ({ fakes, wait, s } = createHarness());
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

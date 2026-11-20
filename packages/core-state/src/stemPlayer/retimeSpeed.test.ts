import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { retimeSpeed } from './retimeSpeed.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a speed step queued for a song that is no longer open', () => {
  const FIRST_SESSION = 1;
  const SECOND_SESSION = 2;
  const OWED_RATE = 0.9;
  const TAPPED_RATE = 1.1;

  function guarded() {
    let current = FIRST_SESSION;
    const commands = {
      mixerRate: vi.fn(() => Promise.resolve(OWED_RATE)),
      mixerSetRate: vi.fn(() => Promise.resolve<number>(KB_RESULT.KB_OK)),
    };
    const speed = retimeSpeed(
      () => commands,
      () => current,
      () => undefined,
    );
    return {
      commands,
      speed,
      openNext: () => {
        current = SECOND_SESSION;
      },
    };
  }

  it('sets nothing and resolves false', async () => {
    const { commands, speed, openNext } = guarded();
    const applied = speed.set(TAPPED_RATE);
    openNext();
    await expect(applied).resolves.toBe(false);
    expect(commands.mixerSetRate).not.toHaveBeenCalled();
  });

  it('does not slow the next song for a retime entered on the first', async () => {
    const { commands, speed, openNext } = guarded();
    speed.enter(() => undefined);
    openNext();
    await vi.advanceTimersByTimeAsync(0);
    expect(commands.mixerRate).not.toHaveBeenCalled();
    expect(commands.mixerSetRate).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';

import { plainStart } from './actions.ts';
import { onSongStarting } from './songStarting.ts';
import type { MixerRuntime } from './runtime.ts';

describe('a plain song start', () => {
  it('tells other Kitbag clicks before the mixer plays', () => {
    const mixerPlay = vi.fn();
    const runtime = { commands: { mixerPlay } } as unknown as MixerRuntime;
    const starting = vi.fn(() => {
      expect(mixerPlay).not.toHaveBeenCalled();
    });
    const stop = onSongStarting(starting);
    plainStart(() => runtime).play(0);
    stop();
    expect(starting).toHaveBeenCalledOnce();
    expect(mixerPlay).toHaveBeenCalledOnce();
  });
});

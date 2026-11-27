import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fakePlayAlong,
  locked,
  metronomeCommands,
} from '../playAlong/store.test-helper.ts';
import { createMetronomeStore } from './store.ts';

const SOUND = 3;

let commands: ReturnType<typeof metronomeCommands>;
let metronome: ReturnType<typeof createMetronomeStore>;

beforeEach(() => {
  commands = metronomeCommands();
  metronome = createMetronomeStore(commands, () => 0);
  locked(
    fakePlayAlong({
      yieldStandalone: () => metronome.getState().yieldEngine(),
    }),
  );
  metronome.getState().holdEngine();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('a sound preview while Play along holds a lock', () => {
  it('sounds on the selected slot although the standalone has yielded', () => {
    metronome.getState().previewSelectedSlot(SOUND, true);
    expect(commands.previewSound).toHaveBeenCalledExactlyOnceWith(SOUND, true);
  });

  it('is still dropped by the standalone preview', () => {
    metronome.getState().previewSound(SOUND, true);
    expect(commands.previewSound).not.toHaveBeenCalled();
  });
});

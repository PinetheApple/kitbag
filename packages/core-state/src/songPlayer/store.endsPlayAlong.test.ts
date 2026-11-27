import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMetronomeStore } from '../metronome/store.ts';
import { clickStartsOf } from '../playAlong/runtime.ts';
import {
  fakePlayAlong,
  fakeSongCardStarts,
  locked,
  metronomeCommands,
} from '../playAlong/store.test-helper.ts';
import { plainStart } from '../stemPlayer/actions.ts';
import type { MixerRuntime } from '../stemPlayer/runtime.ts';
import { openedSong } from './store.test-helper.ts';

function lockedPlayAlong() {
  const metronome = createMetronomeStore(metronomeCommands(), () => 0);
  return locked(
    fakePlayAlong({
      onClickStarting: clickStartsOf(metronome, fakeSongCardStarts().starts),
    }),
  ).store;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('starting a Kitbag song while Play along follows', () => {
  it('ends the follow when a library song plays', async () => {
    const { store } = await openedSong();
    const playAlong = lockedPlayAlong();
    store.getState().togglePlay();
    expect(playAlong.getState().lock).toBeUndefined();
  });

  it('ends the follow when a stem song plays', () => {
    const playAlong = lockedPlayAlong();
    const mixer = { commands: { mixerPlay: vi.fn() } };
    plainStart(() => mixer as unknown as MixerRuntime).play(0);
    expect(playAlong.getState().lock).toBeUndefined();
  });
});

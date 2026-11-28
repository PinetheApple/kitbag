import { customSoundId, KB_DEFAULT_SOUNDS } from '@kitbag/core-native';
import { expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { createMetronomeStore } from '../metronome/store.ts';
import { stubMetronomeRuntime } from '../metronome/runtime.test-helper.ts';
import { releaseRemovedSound, restoreReleasedSound } from './released.ts';

const ENGINE_BPM = 120;
const BUILT_IN = 2;

stubMetronomeRuntime(ENGINE_BPM);

function harness() {
  const metronome = createMetronomeStore();
  const refresh = vi.fn(() => Promise.resolve());
  const library = createStore(() => ({ refresh }));
  return { metronome, library, refresh };
}

it('puts Tick back on whichever live role used the removed sound', async () => {
  const { metronome, library, refresh } = harness();
  const removed = customSoundId(0);
  metronome.getState().setSounds(removed, BUILT_IN);
  await releaseRemovedSound(removed, metronome, library);
  expect(metronome.getState().sounds).toEqual({
    normal: KB_DEFAULT_SOUNDS.normal,
    accent: BUILT_IN,
  });
  expect(refresh).toHaveBeenCalledOnce();
});

it('puts the sound back on the live roles Undo finds unchanged', async () => {
  const { metronome, library, refresh } = harness();
  const removed = customSoundId(0);
  metronome.getState().setSounds(removed, removed);
  const released = await releaseRemovedSound(removed, metronome, library);
  metronome.getState().setSounds(KB_DEFAULT_SOUNDS.normal, BUILT_IN);
  await restoreReleasedSound(removed, released, metronome, library);
  expect(metronome.getState().sounds).toEqual({
    normal: removed,
    accent: BUILT_IN,
  });
  expect(refresh).toHaveBeenCalledTimes(2);
});

it('leaves live sounds alone when neither role used it', async () => {
  const { metronome, library } = harness();
  const kept = customSoundId(1);
  metronome.getState().setSounds(BUILT_IN, kept);
  await releaseRemovedSound(customSoundId(0), metronome, library);
  expect(metronome.getState().sounds).toEqual({
    normal: BUILT_IN,
    accent: kept,
  });
});

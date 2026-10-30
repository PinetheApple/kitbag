import { KB_RESULT } from '@kitbag/core-native';
import { describe, expect, it, vi } from 'vitest';

import { createStemPlayerStore } from './store.ts';
import {
  BARS,
  fakeRuntime,
  opened,
  record,
  SAVE_MS,
  SEEK_MS,
  stem,
} from './store.test-helper.ts';

const SET_ID = 7;
const CYCLES = 10;

function setup() {
  const fake = fakeRuntime(record([stem(1), stem(2)]));
  const store = createStemPlayerStore(() => fake.runtime, {
    mixSaveDelayMs: SAVE_MS,
    scrubSeekDelayMs: SEEK_MS,
  });
  return { ...fake, store };
}

function firstCall(fn: { mock: { invocationCallOrder: number[] } }): number {
  return fn.mock.invocationCallOrder[0] ?? Number.NaN;
}

describe('the stem player holding the output device', () => {
  it('releases once after stopping the mixer when closed under a playing click', async () => {
    const { commands, engine, store } = await opened([stem(1)]);
    await store.getState().toggleClick();
    store.getState().togglePlay();
    engine.playing = true;
    store.getState().close();
    expect(commands.engineHold).toHaveBeenCalledOnce();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
    expect(firstCall(commands.mixerStop)).toBeLessThan(
      firstCall(commands.engineRelease),
    );
    expect(commands.stop).not.toHaveBeenCalled();
  });

  it('keeps the hold and plays again after a pause', async () => {
    const { commands, engine, store } = await opened([stem(1)]);
    store.getState().togglePlay();
    engine.playing = true;
    store.getState().togglePlay();
    engine.playing = false;
    store.getState().togglePlay();
    expect(commands.mixerPause).toHaveBeenCalledOnce();
    expect(commands.mixerPlay).toHaveBeenCalledTimes(2);
    expect(commands.engineRelease).not.toHaveBeenCalled();
    expect(commands.stop).not.toHaveBeenCalled();
  });

  it('keeps one hold while a second song replaces the first', async () => {
    const { commands, store } = setup();
    await store.getState().open(SET_ID, BARS);
    await store.getState().open(SET_ID, BARS);
    expect(commands.engineHold).toHaveBeenCalledOnce();
    expect(commands.engineRelease).not.toHaveBeenCalled();
    store.getState().close();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
  });

  it('balances holds and releases across opens, failures and stray closes', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { commands, records, store } = setup();
    store.getState().close();
    commands.engineHold
      .mockResolvedValueOnce(KB_RESULT.KB_ERROR_DEVICE_START_FAILED)
      .mockRejectedValueOnce(new Error('no module'));
    records.readStemSet
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('locked'));
    for (let cycle = 0; cycle < CYCLES; cycle++) {
      await store.getState().open(SET_ID, BARS);
      store.getState().close();
      store.getState().close();
    }
    expect(commands.engineHold).toHaveBeenCalledTimes(CYCLES);
    expect(commands.engineRelease).toHaveBeenCalledTimes(CYCLES);
    expect(commands.stop).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('releases a song closed before it finished opening', async () => {
    const { commands, store } = setup();
    const opening = store.getState().open(SET_ID, BARS);
    store.getState().close();
    await opening;
    expect(commands.engineHold).toHaveBeenCalledOnce();
    expect(commands.engineRelease).toHaveBeenCalledOnce();
  });
});

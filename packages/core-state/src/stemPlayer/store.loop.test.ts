import { KB_RESULT } from '@kitbag/core-native';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BARS, opened, RATE, stem } from './store.test-helper.ts';

type Answer = (code: number) => void;

function deferred(answers: Answer[]) {
  return () =>
    new Promise<number>((resolve) => {
      answers.push(resolve);
    });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('A-B loop', () => {
  it('sets a beat-snapped loop in engine frames and clears it', async () => {
    const { commands, engine, store } = await opened([stem(1)]);
    engine.position = Math.round(0.9 * RATE);
    await store.getState().markLoop();
    engine.position = Math.round(2.2 * RATE);
    await store.getState().markLoop();
    expect(commands.mixerSetLoop).toHaveBeenCalledWith(RATE, 2 * RATE);
    await store.getState().markLoop();
    expect(commands.mixerClearLoop).toHaveBeenCalledTimes(1);
    expect(store.getState().loop).toEqual({ kind: 'off' });
  });

  it.each([
    ['the end lies past the song', () => Promise.resolve(1), 'pastEnd'],
    ['a track cannot rebuild', () => Promise.resolve(5), 'engine'],
    ['the call throws', () => Promise.reject(new Error('gone')), 'engine'],
  ] as const)(
    'never shows a loop the engine did not take: %s',
    async (_, answer, failure) => {
      const { commands, engine, store } = await opened([stem(1)]);
      commands.mixerSetLoop.mockImplementationOnce(answer);
      engine.position = RATE;
      await store.getState().markLoop();
      engine.position = 2 * RATE;
      await store.getState().markLoop();
      expect(store.getState().loop).toEqual({ kind: 'off' });
      expect(store.getState().loopFailure).toBe(failure);
      await store.getState().markLoop();
      expect(store.getState().loopFailure).toBe(null);
    },
  );

  it('keeps the end inside the song', async () => {
    const { commands, engine, store } = await opened([stem(1)]);
    store.setState({ beats: [8, 9.5, 11] });
    engine.position = 8 * RATE;
    await store.getState().markLoop();
    engine.position = 11 * RATE;
    await store.getState().markLoop();
    expect(commands.mixerSetLoop).toHaveBeenCalledWith(8 * RATE, 10 * RATE);
    expect(store.getState().loop).toEqual({
      kind: 'on',
      startSec: 8,
      endSec: 10,
    });
  });

  it('shows the loop only once the engine has confirmed it', async () => {
    const { commands, engine, store } = await opened([stem(1)]);
    const answers: Answer[] = [];
    commands.mixerSetLoop.mockImplementationOnce(deferred(answers));
    engine.position = RATE;
    await store.getState().markLoop();
    engine.position = 2 * RATE;
    const pending = store.getState().markLoop();
    expect(store.getState().loop.kind).toBe('armed');
    answers[0]?.(KB_RESULT.KB_OK);
    await pending;
    expect(store.getState().loop).toEqual({
      kind: 'on',
      startSec: 1,
      endSec: 2,
    });
  });

  it('keeps the loop when the end is tapped again before the engine answers', async () => {
    const { commands, engine, store } = await opened([stem(1)]);
    const answers: Answer[] = [];
    commands.mixerSetLoop.mockImplementation(deferred(answers));
    engine.position = RATE;
    await store.getState().markLoop();
    engine.position = 2 * RATE;
    const first = store.getState().markLoop();
    const second = store.getState().markLoop();
    for (const answer of answers) answer(KB_RESULT.KB_OK);
    await Promise.all([first, second]);
    expect(store.getState().loop.kind).toBe('on');
    expect(commands.mixerClearLoop).not.toHaveBeenCalled();
  });

  it('keeps the loop on and says so when the engine cannot clear it', async () => {
    const { commands, engine, store } = await opened([stem(1)]);
    commands.mixerClearLoop.mockResolvedValueOnce(KB_RESULT.KB_ERROR_INTERNAL);
    engine.position = RATE;
    await store.getState().markLoop();
    engine.position = 2 * RATE;
    await store.getState().markLoop();
    await store.getState().markLoop();
    expect(store.getState().loop.kind).toBe('on');
    expect(store.getState().loopFailure).toBe('engine');
  });

  it('drops a loop the engine confirms after the song was closed and reopened', async () => {
    const { commands, engine, store } = await opened([stem(1)]);
    const answers: Answer[] = [];
    commands.mixerSetLoop.mockImplementationOnce(deferred(answers));
    engine.position = RATE;
    await store.getState().markLoop();
    engine.position = 2 * RATE;
    const pending = store.getState().markLoop();
    store.getState().close();
    await store.getState().open(7, BARS);
    commands.mixerClearLoop.mockClear();
    answers[0]?.(KB_RESULT.KB_OK);
    await pending;
    expect(store.getState().loop).toEqual({ kind: 'off' });
    expect(commands.mixerClearLoop).toHaveBeenCalledTimes(1);
    engine.position = RATE;
    await store.getState().markLoop();
    expect(store.getState().loop.kind).toBe('armed');
  });
});

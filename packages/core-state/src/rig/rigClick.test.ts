import { KB_RESULT, KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { createRigClick, type RigClickDeps } from './rigClick.ts';
import { RIG_CLICK_BPM } from './rigClickRules.ts';

const FRAME = 96_000;

const flush = () => new Promise((r) => setTimeout(r, 0));

function harness(result: number | 'reject' = KB_RESULT.KB_OK) {
  const calls = { starts: [] as number[][], stops: 0 };
  const resolvers: ((value: number) => void)[] = [];
  let deferred = false;
  const deps: RigClickDeps = {
    startClick: (bpm, subdivision, startFrame) => {
      calls.starts.push([bpm, subdivision, startFrame]);
      if (result === 'reject') return Promise.reject(new Error('no device'));
      if (deferred) return new Promise((r) => resolvers.push(r));
      return Promise.resolve(result);
    },
    stopClick: () => {
      calls.stops += 1;
    },
    nowFrame: () => FRAME,
  };
  const click = createRigClick(deps);
  return {
    click,
    calls,
    defer: () => {
      deferred = true;
    },
    resolveStart: (value: number) => {
      resolvers.shift()?.(value);
    },
  };
}

describe('rig click', () => {
  it('plays the rig tempo on the beat from the current frame', async () => {
    const { click, calls } = harness();
    await click.getState().play();
    expect(calls.starts).toEqual([
      [RIG_CLICK_BPM, KB_SUBDIVISION_BOUNDS.min, FRAME],
    ]);
    expect(click.getState().phase).toBe('playing');
  });

  it('says the metronome is busy instead of failing silently', async () => {
    const { click } = harness(KB_RESULT.KB_ERROR_BUSY);
    await click.getState().play();
    expect(click.getState().phase).toBe('busy');
  });

  it('reports a click that could not start', async () => {
    const rejected = harness('reject');
    await rejected.click.getState().play();
    expect(rejected.click.getState().phase).toBe('failed');
    const refused = harness(KB_RESULT.KB_ERROR_INVALID_ARGUMENT);
    await refused.click.getState().play();
    expect(refused.click.getState().phase).toBe('failed');
  });

  it('stops the click and forgets it was playing', async () => {
    const { click, calls } = harness();
    await click.getState().play();
    click.getState().stop();
    expect(calls.stops).toBe(1);
    expect(click.getState().phase).toBe('idle');
  });

  it('keeps a start that lands after a stop from playing', async () => {
    const { click, calls, defer, resolveStart } = harness();
    defer();
    const started = click.getState().play();
    click.getState().stop();
    resolveStart(KB_RESULT.KB_OK);
    await started;
    await flush();
    expect(click.getState().phase).toBe('idle');
    expect(calls.stops).toBe(2);
  });

  it('restarts at another subdivision to hear the accents', async () => {
    const { click, calls } = harness();
    await click.getState().play();
    await click.getState().play(4);
    expect(calls.starts.at(-1)).toEqual([RIG_CLICK_BPM, 4, FRAME]);
    expect(click.getState().subdivision).toBe(4);
    expect(click.getState().phase).toBe('playing');
  });

  it('toggles between playing and stopped', async () => {
    const { click, calls } = harness();
    await click.getState().toggle();
    expect(click.getState().phase).toBe('playing');
    await click.getState().toggle();
    expect(click.getState().phase).toBe('idle');
    expect(calls.stops).toBe(1);
  });
});

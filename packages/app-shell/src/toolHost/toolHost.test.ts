import { KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import { afterEach, describe, expect, it } from 'vitest';

import { toolHost } from './toolHost.ts';

const TRANSPORT = { bar_phase: 0.75, current_beat: 2, current_bpm: 101 };

afterEach(() => {
  Reflect.deleteProperty(globalThis, KITBAG_HOST_OBJECT_KEY);
});

describe('toolHost', () => {
  it('wires each engine read to its HostObject property', () => {
    Reflect.set(globalThis, KITBAG_HOST_OBJECT_KEY, TRANSPORT);
    const { reads } = toolHost.engine;
    expect([reads.barPhase(), reads.currentBeat(), reads.currentBpm()]).toEqual(
      [TRANSPORT.bar_phase, TRANSPORT.current_beat, TRANSPORT.current_bpm],
    );
  });
});

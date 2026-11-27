import { KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import type { RegisterTool } from '@kitbag/core-plugin-api';
import { afterEach, describe, expect, it } from 'vitest';

import { toolHost } from './toolHost.ts';

const TRANSPORT = { bar_phase: 0.75, current_beat: 2, current_bpm: 101 };

const registerFixture: RegisterTool = (host) => {
  const drill = host.store.createToolStore({ reps: 0 });
  return {
    id: 'fixture',
    name: `Fixture ${String(drill.getState().reps)}`,
    icon: 'tuner',
    routes: [],
    requires: [],
  };
};

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

  it('creates tool stores', () => {
    const store = toolHost.store.createToolStore({ reps: 0 });
    store.setState({ reps: 3 });
    expect(store.getState().reps).toBe(3);
  });

  it('is what a tool registers against', () => {
    expect(registerFixture(toolHost).name).toBe('Fixture 0');
  });
});

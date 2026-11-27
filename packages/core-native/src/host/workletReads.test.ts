import { afterEach, describe, expect, it } from 'vitest';

import {
  KB_STOPPED_BEAT,
  KITBAG_HOST_OBJECT_KEY,
  type KitbagHostObject,
} from './KitbagHostObject.ts';
import {
  readBarPhase,
  readCurrentBeat,
  readCurrentBpm,
} from './workletReads.ts';

type TransportHost = Pick<
  KitbagHostObject,
  'bar_phase' | 'current_beat' | 'current_bpm'
>;
type HostSlot = Partial<Record<typeof KITBAG_HOST_OBJECT_KEY, TransportHost>>;

const slot = globalThis as unknown as HostSlot;
const reads = [readBarPhase, readCurrentBeat, readCurrentBpm];

function readAll(): number[] {
  return reads.map((read) => read());
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, KITBAG_HOST_OBJECT_KEY);
});

describe('worklet engine reads', () => {
  it('read the installed HostObject on every call', () => {
    slot[KITBAG_HOST_OBJECT_KEY] = {
      bar_phase: 0.25,
      current_beat: 3,
      current_bpm: 132.5,
    };
    expect(readAll()).toEqual([0.25, 3, 132.5]);

    slot[KITBAG_HOST_OBJECT_KEY] = {
      bar_phase: 0.5,
      current_beat: 0,
      current_bpm: 90,
    };
    expect(readAll()).toEqual([0.5, 0, 90]);
  });

  it('read as a stopped transport before the HostObject is installed', () => {
    expect(readAll()).toEqual([0, KB_STOPPED_BEAT, 0]);
  });

  it.each(reads)('%o is worklet-marked', (read) => {
    expect(String(read)).toMatch(/^function \w+\(\) \{\s*['"]worklet['"]/);
  });
});

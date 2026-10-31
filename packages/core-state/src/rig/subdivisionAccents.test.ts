import { KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import {
  accentedSlots,
  createSubdivisionAccentsStore,
  replaySubdivisionAccents,
  toggleSlotMask,
  type SubdivisionAccentsPersistence,
  type SubdivisionAccentsSettings,
} from './subdivisionAccents.ts';

const COUNTS = KB_SUBDIVISION_BOUNDS.max - KB_SUBDIVISION_BOUNDS.min + 1;

function memory(initial: Partial<SubdivisionAccentsSettings> = {}) {
  const saved: Partial<SubdivisionAccentsSettings>[] = [];
  const persistence: SubdivisionAccentsPersistence = {
    load: () => initial,
    save: (changed) => {
      saved.push(changed);
    },
  };
  return { persistence, saved };
}

describe('subdivision accent masks', () => {
  it('sets bit s for slot s and never bit 0', () => {
    expect(toggleSlotMask(0, 2)).toBe(0b100);
    expect(toggleSlotMask(0b100, 2)).toBe(0);
    expect(toggleSlotMask(0b100, 0)).toBe(0b100);
  });

  it('reads slot 0 as unaccented whatever bit 0 holds', () => {
    expect(accentedSlots(0b1011, 4)).toEqual([false, true, false, true]);
  });
});

describe('subdivision accents store', () => {
  it('keeps one pattern per subdivision count', () => {
    const store = createSubdivisionAccentsStore();
    store.getState().toggle(4, 2);
    store.getState().toggle(3, 1);
    expect(store.getState().masks[4]).toBe(0b100);
    expect(store.getState().masks[3]).toBe(0b10);
    expect(store.getState().masks[2]).toBe(0);
  });

  it('cannot accent the on-beat slot', () => {
    const store = createSubdivisionAccentsStore();
    store.getState().toggle(4, 0);
    expect(store.getState().masks[4]).toBe(0);
  });

  it('resets one count to all normal', () => {
    const store = createSubdivisionAccentsStore();
    store.getState().toggle(4, 1);
    store.getState().toggle(3, 2);
    store.getState().reset(4);
    expect(store.getState().masks[4]).toBe(0);
    expect(store.getState().masks[3]).toBe(0b100);
  });

  it('remembers the count last edited for the row preview', () => {
    const store = createSubdivisionAccentsStore();
    store.getState().toggle(3, 1);
    expect(store.getState().lastCount).toBe(3);
  });

  it('saves every edit and loads it back', () => {
    const first = memory();
    const store = createSubdivisionAccentsStore(first.persistence);
    store.getState().toggle(4, 2);
    const written = Object.assign(
      {},
      ...first.saved,
    ) as Partial<SubdivisionAccentsSettings>;
    expect(written.masks?.[4]).toBe(0b100);
    expect(written.lastCount).toBe(4);
    const reloaded = createSubdivisionAccentsStore(memory(written).persistence);
    expect(reloaded.getState().masks[4]).toBe(0b100);
    expect(reloaded.getState().lastCount).toBe(4);
  });

  it('drops stored bits the engine would ignore or reject', () => {
    const masks = Array.from({ length: COUNTS + 1 }, () => 0);
    masks[4] = 0b1_0001_0101;
    masks[2] = -1;
    const store = createSubdivisionAccentsStore(
      memory({ masks, lastCount: 99 }).persistence,
    );
    expect(store.getState().masks[4]).toBe(0b0100);
    expect(store.getState().masks[2]).toBe(0);
    expect(store.getState().lastCount).toBe(KB_SUBDIVISION_BOUNDS.min);
  });
});

describe('replaying accents to the engine', () => {
  it('sends every count at start, then each edited count', () => {
    const store = createSubdivisionAccentsStore(
      memory({ masks: [0, 0, 0, 0, 0b100] }).persistence,
    );
    const sent: [number, number][] = [];
    const stop = replaySubdivisionAccents(store, (count, mask) => {
      sent.push([count, mask]);
    });
    expect(sent).toHaveLength(COUNTS);
    expect(sent).toContainEqual([4, 0b100]);
    sent.length = 0;
    store.getState().toggle(3, 2);
    expect(sent).toEqual([[3, 0b100]]);
    stop();
    store.getState().toggle(3, 1);
    expect(sent).toHaveLength(1);
  });
});

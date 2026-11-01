import { KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import { persistedStore } from '../persistedStore.ts';

export const ON_BEAT_SLOT = 0;
const ON_BEAT_BIT = 1 << ON_BEAT_SLOT;

export interface SubdivisionAccentsSettings {
  readonly masks: readonly number[];
  readonly lastCount: number;
}

export interface SubdivisionAccentsPersistence {
  readonly load: () => Partial<SubdivisionAccentsSettings>;
  readonly save: (changed: Partial<SubdivisionAccentsSettings>) => void;
}

export interface SubdivisionAccentsStore extends SubdivisionAccentsSettings {
  readonly toggle: (count: number, slot: number) => void;
  readonly reset: (count: number) => void;
}

export type SubdivisionAccentsStoreApi = StoreApi<SubdivisionAccentsStore>;

export type SendSubdivisionAccents = (count: number, slotMask: number) => void;

const COUNTS = Array.from(
  { length: KB_SUBDIVISION_BOUNDS.max - KB_SUBDIVISION_BOUNDS.min + 1 },
  (_unused, i) => KB_SUBDIVISION_BOUNDS.min + i,
);

const isCount = (count: number) =>
  Number.isInteger(count) &&
  count >= KB_SUBDIVISION_BOUNDS.min &&
  count <= KB_SUBDIVISION_BOUNDS.max;

const slotsBelow = (count: number) => (1 << count) - 1;

function engineMask(mask: unknown, count: number): number {
  if (typeof mask !== 'number' || !Number.isInteger(mask) || mask < 0) return 0;
  return mask & slotsBelow(count) & ~ON_BEAT_BIT;
}

function emptyMasks(): number[] {
  return Array.from({ length: KB_SUBDIVISION_BOUNDS.max + 1 }, () => 0);
}

function loadedMasks(stored: readonly unknown[] | undefined): number[] {
  const masks = emptyMasks();
  for (const count of COUNTS) masks[count] = engineMask(stored?.[count], count);
  return masks;
}

export function toggleSlotMask(mask: number, slot: number): number {
  if (slot === ON_BEAT_SLOT) return mask;
  return mask ^ (1 << slot);
}

export function accentedSlots(mask: number, count: number): boolean[] {
  return Array.from(
    { length: count },
    (_unused, slot) => slot !== ON_BEAT_SLOT && (mask & (1 << slot)) !== 0,
  );
}

const accents = persistedStore<
  SubdivisionAccentsPersistence,
  SubdivisionAccentsStore
>(
  'Subdivision accents',
  { load: () => ({}), save: () => undefined },
  (persistence, commit) => {
    const stored = persistence.load();
    let masks = loadedMasks(stored.masks);
    const write = (count: number, mask: number) => {
      if (!isCount(count)) return;
      commit('lastCount', count, (lastCount) => {
        persistence.save({ lastCount });
      });
      const next = [...masks];
      next[count] = engineMask(mask, count);
      if (next[count] === masks[count]) return;
      masks = next;
      commit('masks', next, (changed) => {
        persistence.save({ masks: changed });
      });
    };
    return {
      masks,
      lastCount:
        stored.lastCount !== undefined && isCount(stored.lastCount)
          ? stored.lastCount
          : KB_SUBDIVISION_BOUNDS.min,
      toggle: (count, slot) => {
        write(count, toggleSlotMask(masks[count] ?? 0, slot));
      },
      reset: (count) => {
        write(count, 0);
      },
    };
  },
);

export const createSubdivisionAccentsStore = accents.create;
export const configureSubdivisionAccentsPersistence = accents.configure;
export const getSubdivisionAccentsStore = accents.get;

export function replaySubdivisionAccents(
  store: SubdivisionAccentsStoreApi,
  send: SendSubdivisionAccents,
): () => void {
  for (const count of COUNTS) send(count, store.getState().masks[count] ?? 0);
  return store.subscribe((state, previous) => {
    for (const count of COUNTS) {
      const mask = state.masks[count] ?? 0;
      if (mask !== (previous.masks[count] ?? 0)) send(count, mask);
    }
  });
}

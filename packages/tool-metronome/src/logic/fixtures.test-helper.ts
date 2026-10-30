import type { SetlistEntry, SetlistSummary } from '@kitbag/core-state';

export const summary = (
  id: number,
  name: string,
  active: boolean,
  songCount: number,
) =>
  ({
    setlist: { id, name, active },
    songCount,
    rampCount: 0,
  }) as unknown as SetlistSummary;

export const entry = (
  itemId: number,
  name = '',
  bpm = 120,
  presetId = itemId,
) =>
  ({
    item: { id: itemId },
    preset: { id: presetId, name, bpm },
  }) as unknown as SetlistEntry;

import type { StoredSection } from '@kitbag/core-db';

import { lastAtOrBefore, NOT_FOUND } from './search.ts';

export const NO_SECTION = NOT_FOUND;

export function sortedSections(
  sections: readonly StoredSection[],
): StoredSection[] {
  return [...sections].sort((a, b) => a.startSec - b.startSec);
}

export function sectionAt(
  sections: readonly StoredSection[],
  songSec: number,
): number {
  'worklet';
  const index = lastAtOrBefore(sections, 'startSec', songSec);
  const end = sections[index]?.endSec ?? -Infinity;
  return songSec < end ? index : NO_SECTION;
}

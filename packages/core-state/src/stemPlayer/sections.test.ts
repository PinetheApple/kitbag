import type { StoredSection } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { NO_SECTION, sectionAt, sortedSections } from './sections.ts';

function section(name: string, startSec: number, endSec: number) {
  return { name, kind: '', color: '', startSec, endSec };
}

const SECTIONS: StoredSection[] = [
  section('Intro', 0, 12.25),
  section('Verse', 12.25, 48.5),
  section('Outro', 60, 70),
];

describe('the section at a song time', () => {
  it('is the section whose span holds the time, end excluded', () => {
    expect(sectionAt(SECTIONS, 0)).toBe(0);
    expect(sectionAt(SECTIONS, 12.24)).toBe(0);
    expect(sectionAt(SECTIONS, 12.25)).toBe(1);
    expect(sectionAt(SECTIONS, 69.9)).toBe(2);
  });

  it('is no section in a gap, past the end, before the start or without sections', () => {
    expect(sectionAt(SECTIONS, 50)).toBe(NO_SECTION);
    expect(sectionAt(SECTIONS, 70)).toBe(NO_SECTION);
    expect(sectionAt(SECTIONS, -1)).toBe(NO_SECTION);
    expect(sectionAt([], 1)).toBe(NO_SECTION);
  });

  it('orders sections by their start', () => {
    expect(sortedSections([...SECTIONS].reverse())).toEqual(SECTIONS);
  });
});

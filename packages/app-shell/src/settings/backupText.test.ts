import type { CategoryPlan, ImportPlan } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import {
  applyLabel,
  backupSummary,
  categoryValue,
  conflictBanner,
  failureText,
  modeHint,
  restoredText,
  sourceDetail,
} from './backupText.ts';

function counts(fields: Partial<CategoryPlan>): CategoryPlan {
  return {
    incoming: 0,
    new: 0,
    unchanged: 0,
    updates: 0,
    conflicts: [],
    deletes: 0,
    ...fields,
  };
}

const MERGE_PLAN = {
  mode: 'merge',
  categories: ['songPresets', 'setlists', 'tunings'],
  counts: {
    songPresets: counts({ incoming: 24, new: 6, deletes: 0 }),
    setlists: counts({ incoming: 3, new: 1 }),
    tunings: counts({ incoming: 2, new: 2 }),
  },
} as unknown as ImportPlan;

describe('Settings Data rows', () => {
  it('summarises the library as setlists and songs', () => {
    expect(backupSummary({ setlists: 3, songPresets: 24 })).toBe(
      '3 setlists · 24 songs',
    );
    expect(backupSummary({ setlists: 1, songPresets: 1 })).toBe(
      '1 setlist · 1 song',
    );
  });
});

describe('restore source card', () => {
  it('shows version, export date and size', () => {
    expect(sourceDetail(4, '2026-07-14T12:00:00.000Z', 1_200_000)).toBe(
      'v4 · 14 Jul 2026 · 1.2 MB',
    );
  });
});

describe('category rows', () => {
  it('shows the diff for a selected category', () => {
    expect(categoryValue('setlists', 3, counts({ incoming: 3, new: 1 }))).toBe(
      '3 · 1 new',
    );
    expect(categoryValue('tunings', 2, counts({ incoming: 2, new: 2 }))).toBe(
      '2 · all new',
    );
  });

  it('shows only the file count for an unselected category', () => {
    expect(categoryValue('practiceSessions', 34, undefined)).toBe(
      '34 sessions',
    );
    expect(categoryValue('tunings', 2, undefined)).toBe('2');
  });

  it('says library rows carry no audio, selected or not', () => {
    expect(categoryValue('librarySongs', 17, undefined)).toBe(
      '17 · files not included',
    );
    expect(
      categoryValue('librarySongs', 17, counts({ incoming: 17, new: 3 })),
    ).toBe('17 · files not included');
  });
});

describe('mode copy', () => {
  it('promises merge keeps what you have', () => {
    expect(modeHint(MERGE_PLAN)).toBe(
      'Keeps what you have. Items already here are updated, not duplicated.',
    );
  });

  it('names exactly what replace deletes', () => {
    const plan = {
      ...MERGE_PLAN,
      mode: 'replace',
      counts: {
        songPresets: counts({ deletes: 24 }),
        setlists: counts({ deletes: 3 }),
        tunings: counts({ deletes: 0 }),
      },
    } as unknown as ImportPlan;
    expect(modeHint(plan)).toBe('Deletes your 3 setlists and 24 songs');
  });

  it('says when replace deletes nothing', () => {
    const plan = {
      ...MERGE_PLAN,
      mode: 'replace',
      counts: { tunings: counts({ deletes: 0 }) },
      categories: ['tunings'],
    } as unknown as ImportPlan;
    expect(modeHint(plan)).toBe('Deletes nothing you have');
  });

  it('labels the merge button with the first two categories', () => {
    expect(applyLabel(MERGE_PLAN)).toBe('Merge 3 setlists & 24 songs');
  });

  it('labels the replace button the same every time', () => {
    expect(applyLabel({ ...MERGE_PLAN, mode: 'replace' })).toBe(
      'Replace everything',
    );
  });
});

describe('conflict banner', () => {
  it('names the category when every conflict shares one', () => {
    const two = [
      { category: 'setlists', key: 'a', label: 'A' },
      { category: 'setlists', key: 'b', label: 'B' },
    ] as const;
    expect(conflictBanner(two)).toBe('2 setlists differ from yours.');
    expect(conflictBanner(two.slice(0, 1))).toBe(
      '1 setlist differs from yours.',
    );
  });

  it('counts items across categories', () => {
    expect(
      conflictBanner([
        { category: 'setlists', key: 'a', label: 'A' },
        { category: 'songPresets', key: 'b', label: 'B' },
      ]),
    ).toBe('2 items differ from yours.');
  });
});

describe('failures', () => {
  it('asks for an update when the file is newer', () => {
    expect(failureText({ kind: 'unsupportedVersion', version: 5 })).toBe(
      'Made with a newer Kitbag (v5). Update to restore this.',
    );
  });

  it('refuses a foreign or damaged file and says nothing changed', () => {
    expect(failureText({ kind: 'malformedFile', reason: 'x' })).toBe(
      'This file is not a Kitbag backup. Nothing was changed.',
    );
    expect(
      failureText({ kind: 'invalidField', path: '$.a', reason: 'x' }),
    ).toBe('This backup is damaged. Nothing was changed.');
  });
});

describe('result', () => {
  it('says what was merged', () => {
    expect(restoredText('merge', MERGE_PLAN.counts)).toBe(
      'Merged 3 setlists, 24 songs & 2 tunings.',
    );
  });
});

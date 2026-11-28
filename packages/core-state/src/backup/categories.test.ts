import type { Category, ImportCategory } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import {
  categoriesForMode,
  isReplaceConfirmed,
  toggledCategories,
} from './categories.ts';

const ALL: readonly Category[] = [
  'librarySongs',
  'songPresets',
  'setlists',
  'tunings',
  'practiceSessions',
  'countInSettings',
];

const WITH_TOOL_DATA: readonly ImportCategory[] = [...ALL, 'toolData'];

describe('toggledCategories', () => {
  it('adds and removes a standalone category in file order', () => {
    expect(
      toggledCategories(['tunings'], 'librarySongs', 'merge', ALL),
    ).toEqual(['librarySongs', 'tunings']);
    expect(toggledCategories(['tunings'], 'tunings', 'merge', ALL)).toEqual([]);
  });

  it('brings the song presets along with setlists', () => {
    expect(toggledCategories([], 'setlists', 'merge', ALL)).toEqual([
      'songPresets',
      'setlists',
    ]);
  });

  it('drops setlists when their song presets go', () => {
    expect(
      toggledCategories(
        ['songPresets', 'setlists'],
        'songPresets',
        'merge',
        ALL,
      ),
    ).toEqual([]);
  });

  it('keeps presets without setlists in merge', () => {
    expect(
      toggledCategories(['songPresets', 'setlists'], 'setlists', 'merge', ALL),
    ).toEqual(['songPresets']);
  });

  it('replaces presets and setlists together', () => {
    expect(toggledCategories([], 'songPresets', 'replace', ALL)).toEqual([
      'songPresets',
      'setlists',
    ]);
    expect(
      toggledCategories(
        ['songPresets', 'setlists'],
        'setlists',
        'replace',
        ALL,
      ),
    ).toEqual([]);
  });

  it('adds tool data on its own, after the categories', () => {
    expect(
      toggledCategories(['tunings'], 'toolData', 'merge', WITH_TOOL_DATA),
    ).toEqual(['tunings', 'toolData']);
  });

  it('removes tool data on its own', () => {
    expect(
      toggledCategories(
        ['tunings', 'toolData'],
        'toolData',
        'replace',
        WITH_TOOL_DATA,
      ),
    ).toEqual(['tunings']);
  });

  it('never selects a category the file does not carry', () => {
    expect(
      toggledCategories([], 'setlists', 'merge', ['setlists', 'tunings']),
    ).toEqual(['setlists']);
    expect(toggledCategories([], 'librarySongs', 'merge', ['tunings'])).toEqual(
      [],
    );
  });
});

describe('categoriesForMode', () => {
  it('adds setlists to presets when switching to replace', () => {
    expect(categoriesForMode(['songPresets'], 'replace', ALL)).toEqual([
      'songPresets',
      'setlists',
    ]);
  });

  it('drops presets for replace when the file has no setlists', () => {
    expect(
      categoriesForMode(['songPresets', 'tunings'], 'replace', [
        'songPresets',
        'tunings',
      ]),
    ).toEqual(['tunings']);
  });

  it('keeps tool data when switching to replace', () => {
    expect(categoriesForMode(['toolData'], 'replace', WITH_TOOL_DATA)).toEqual([
      'toolData',
    ]);
  });

  it('leaves a merge selection alone', () => {
    expect(categoriesForMode(['songPresets'], 'merge', ALL)).toEqual([
      'songPresets',
    ]);
  });
});

describe('isReplaceConfirmed', () => {
  it('takes the word typed in any case, ignoring surrounding space', () => {
    expect(isReplaceConfirmed(' Replace ')).toBe(true);
    expect(isReplaceConfirmed('replace')).toBe(true);
  });

  it('refuses anything else', () => {
    expect(isReplaceConfirmed('')).toBe(false);
    expect(isReplaceConfirmed('replac')).toBe(false);
    expect(isReplaceConfirmed('yes')).toBe(false);
  });
});

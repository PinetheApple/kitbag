import type { BundleRefusalReason } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  copyingText,
  failureText,
  noticeText,
  replaceText,
} from './notices.ts';

describe('noticeText', () => {
  const refused = (reason: BundleRefusalReason) =>
    noticeText({
      kind: 'bundleRefused',
      name: 'Redbone.stemdeck.zip',
      refusal: {
        reason,
        version: 0,
        supportedVersion: 1,
        stemCount: 18,
        maxStems: 16,
      },
    });

  it.each([
    ['notABundle', 'not a StemDeck song bundle'],
    ['version', 'bundle version 0; this Kitbag reads version 1'],
    ['tooManyStems', 'has 18 stems; Kitbag plays up to 16'],
    ['noSpace', 'not enough free space'],
    ['unreadable', 'could not be read'],
  ] as const)('says why a %s bundle was refused', (reason, why) => {
    const { text } = refused(reason);
    expect(text).toContain(why);
    expect(text).toContain('“Redbone.stemdeck.zip”');
    expect(text).toContain('othing was added');
  });

  it('gives each refusal its own status', () => {
    const reasons = [
      'notABundle',
      'version',
      'tooManyStems',
      'noSpace',
      'unreadable',
    ] as const;
    const statuses = new Set(reasons.map((r) => refused(r).status));
    expect(statuses.size).toBe(reasons.length);
  });
});

describe('replaceText', () => {
  it('names the picked file and the song it replaces', () => {
    const text = replaceText('Redbone.stemdeck.zip', 'Redbone');
    expect(text).toContain('“Redbone.stemdeck.zip”');
    expect(text).toContain('“Redbone” in your library');
    expect(text).toContain('your names for the song and its stems are kept');
    expect(text).toContain('cannot be undone');
  });
});

describe('failureText', () => {
  it('names each cause in plain words and offers a retry only where it can help', () => {
    expect(failureText({ kind: 'missingFile', keptGrid: false })).toMatchObject(
      {
        status: 'Missing file',
        canRetry: false,
      },
    );
    expect(failureText({ kind: 'unsupported', keptGrid: false })).toMatchObject(
      {
        status: 'Unsupported format',
        canRetry: false,
      },
    );
    expect(failureText({ kind: 'interrupted', keptGrid: false }).canRetry).toBe(
      true,
    );
    expect(failureText({ kind: 'other', keptGrid: false }).text).toBe(
      'This file could not be analyzed, so there is no beat grid to lock to.',
    );
  });

  it('says the previous grid is kept when a re-analysis fails', () => {
    expect(failureText({ kind: 'unsupported', keptGrid: true })).toEqual({
      status: 'Unsupported format',
      text: 'Re-analysis failed; the previous beat grid is kept.',
      canRetry: true,
    });
  });
});

describe('copyingText', () => {
  it('names one file and counts several', () => {
    expect(copyingText(['a.mp3'])).toBe('Copying “a.mp3” into your library…');
    expect(copyingText(['a.mp3', 'a.mp3'])).toBe(
      'Copying 2 files into your library…',
    );
  });
});

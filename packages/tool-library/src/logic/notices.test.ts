import type { BundleRefusalReason } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  canReanalyze,
  copyingText,
  failureText,
  noticeLook,
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
        stemFormat: 'wav',
        supportedStemFormat: 'flac',
      },
    });

  it.each([
    ['notABundle', 'not a StemDeck song bundle'],
    ['version', 'bundle version 0; this Kitbag reads version 1'],
    ['tooManyStems', 'has 18 stems; Kitbag plays up to 16'],
    ['noSpace', 'not enough free space'],
    ['unreadable', 'could not be read'],
    ['stemFormat', 'has WAV stems; StemDeck song bundles carry FLAC stems'],
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
      'stemFormat',
    ] as const;
    const statuses = new Set(reasons.map((r) => refused(r).status));
    expect(statuses.size).toBe(reasons.length);
  });
});

describe('format refused', () => {
  const refused = (format: string) =>
    ({
      kind: 'formatRefused',
      name: 'Voice memo.m4a',
      format,
      supported: ['WAV', 'MP3', 'FLAC', 'AIFF'],
    }) as const;

  it('names the refused format and the ones Kitbag plays', () => {
    expect(noticeText(refused('m4a'))).toEqual({
      status: 'Unsupported format',
      text: 'Can’t import “Voice memo.m4a”: M4A isn’t supported. Use WAV, MP3, FLAC or AIFF.',
    });
  });

  it('says this format when the file names none', () => {
    expect(noticeText(refused('')).text).toBe(
      'Can’t import “Voice memo.m4a”: this format isn’t supported. Use WAV, MP3, FLAC or AIFF.',
    );
  });

  it('reads as a refusal, not a failure', () => {
    expect(noticeLook(refused('ogg'))).toEqual({
      tone: 'warning',
      icon: 'warning',
    });
  });
});

describe('stem song added elsewhere', () => {
  const added = {
    kind: 'stemSongAdded',
    name: 'Redbone.stemdeck.zip',
  } as const;

  it('says where a bundle picked from Songs went, as a success', () => {
    expect(noticeText(added)).toEqual({
      status: 'Added to Stem songs',
      text: '“Redbone.stemdeck.zip” is a StemDeck song bundle, so it was added to Stem songs.',
    });
    expect(noticeLook(added)).toEqual({ tone: 'success', icon: 'check' });
    expect(noticeLook({ kind: 'pickerFailed' }).tone).toBe('danger');
  });
});

describe('several picked files failed', () => {
  const failed = {
    kind: 'importsFailed',
    names: ['Voice memo.m4a', 'Broken.mp3'],
  } as const;

  it('names every file that was not added, as a failure', () => {
    expect(noticeText(failed)).toEqual({
      status: 'Import failed',
      text: '2 files could not be added to your library: “Voice memo.m4a”, “Broken.mp3”. Import each one on its own to see why.',
    });
    expect(noticeLook(failed).tone).toBe('danger');
  });
});

describe('replaceText', () => {
  it('names the picked file and the song it replaces', () => {
    const text = replaceText('Redbone.stemdeck.zip', 'Redbone', 'job');
    expect(text).toContain('“Redbone.stemdeck.zip”');
    expect(text).toContain('“Redbone” in your library');
    expect(text).toContain('Your names for the song and its stems are kept');
    expect(text).toContain('cannot be undone');
    expect(text).toContain('same StemDeck song');
  });

  it('says a song match is separated again and can be kept as a second song', () => {
    const text = replaceText('Redbone.stemdeck.zip', 'Redbone', 'song');
    expect(text).toContain('“Redbone” in your library, separated again');
    expect(text).toContain('Keep both');
    expect(text).not.toContain('same StemDeck song');
    expect(text).toContain('Bar one and your lyric timing start over');
  });
});

describe('failureText', () => {
  const M4A = {
    kind: 'unsupported',
    keptGrid: false,
    format: 'm4a',
    supported: ['WAV', 'MP3', 'FLAC', 'AIFF'],
  } as const;
  const MISSING_TEXT =
    'The audio file is no longer on this phone, so it cannot be analyzed. Delete the song from its menu, or import the file again.';

  it('names each cause in plain words', () => {
    expect(failureText({ kind: 'missingFile', keptGrid: false })).toEqual({
      status: 'Missing file',
      text: MISSING_TEXT,
    });
    expect(failureText({ kind: 'other', keptGrid: false }).text).toBe(
      'This file could not be analyzed, so there is no beat grid to lock to.',
    );
  });

  it('says a song on a missing SD card waits for the card', () => {
    expect(failureText({ kind: 'unavailable', keptGrid: true })).toEqual({
      status: 'SD card not found',
      text: 'This song is on the SD card, so it can’t play until the card is back.',
    });
  });

  it('names an unsupported format and the formats Kitbag plays', () => {
    expect(failureText(M4A)).toEqual({
      status: 'M4A not supported',
      text: 'M4A isn’t supported. Kitbag plays WAV, MP3, FLAC or AIFF.',
    });
  });

  it('says a supported file that would not decode may be damaged', () => {
    expect(failureText({ kind: 'damaged', keptGrid: false })).toEqual({
      status: 'File may be damaged',
      text: 'This file could not be read in full and may be damaged or incomplete, so there is no beat grid to lock to.',
    });
  });

  it('says the previous grid is kept when a re-analysis fails', () => {
    expect(failureText({ kind: 'damaged', keptGrid: true })).toEqual({
      status: 'File may be damaged',
      text: 'Re-analysis failed; the previous beat grid is kept.',
    });
  });

  it('keeps the guidance over a kept grid where re-analysing cannot help', () => {
    expect(failureText({ kind: 'missingFile', keptGrid: true }).text).toBe(
      MISSING_TEXT,
    );
    expect(failureText({ ...M4A, keptGrid: true }).text).toBe(
      failureText(M4A).text,
    );
  });
});

describe('canReanalyze', () => {
  it.each([
    ['no failure', null, true],
    ['a damaged file', { kind: 'damaged', keptGrid: false }, true],
    ['an interrupted analysis', { kind: 'interrupted', keptGrid: false }, true],
    ['any other failure', { kind: 'other', keptGrid: true }, true],
    ['a missing file', { kind: 'missingFile', keptGrid: false }, false],
    [
      'a file on a missing card',
      { kind: 'unavailable', keptGrid: false },
      false,
    ],
    [
      'an unsupported format',
      { kind: 'unsupported', keptGrid: false, format: 'ogg', supported: [] },
      false,
    ],
  ] as const)('offers Re-analyse for %s: %s', (_case, failure, offered) => {
    expect(canReanalyze(failure)).toBe(offered);
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

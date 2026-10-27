import { describe, expect, it } from 'vitest';

import { copyingText, failureText, noticeText } from './notices.ts';

describe('noticeText', () => {
  it('names the stem file and says nothing was added', () => {
    const { text } = noticeText({
      kind: 'stemImport',
      name: 'Redbone.stemdeck.zip',
    });
    expect(text).toContain('“Redbone.stemdeck.zip”');
    expect(text).toContain('nothing was added');
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

import { describe, expect, it } from 'vitest';

import {
  BPM_SOURCE,
  BPM_SOURCE_CREDIT,
  NOT_FOUND_TEXT,
  notFoundText,
  sourceText,
} from './sources.ts';

describe('source text', () => {
  it('names where a tempo came from', () => {
    expect(sourceText(BPM_SOURCE.getSongBpm)).toBe('via GetSongBPM');
    expect(sourceText(BPM_SOURCE.library)).toBe('via Library');
  });

  it('names every source tried, in order', () => {
    expect(notFoundText([BPM_SOURCE.library, BPM_SOURCE.getSongBpm])).toBe(
      'Not found · Library, GetSongBPM',
    );
  });

  it('says plainly when nothing was tried', () => {
    expect(notFoundText([])).toBe(NOT_FOUND_TEXT);
    expect(NOT_FOUND_TEXT).toBe('Not found');
  });

  it('links back to GetSongBPM for its credit', () => {
    expect(BPM_SOURCE_CREDIT.getsongbpm.url).toBe('https://getsongbpm.com');
  });
});

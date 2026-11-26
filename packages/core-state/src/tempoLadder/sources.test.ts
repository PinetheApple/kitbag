import { describe, expect, it } from 'vitest';

import {
  BPM_SOURCE,
  BPM_SOURCE_CREDIT,
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

  it('links back to GetSongBPM for its credit', () => {
    expect(BPM_SOURCE_CREDIT.getsongbpm.url).toBe('https://getsongbpm.com');
  });
});

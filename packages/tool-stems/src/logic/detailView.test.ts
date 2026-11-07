import { NO_LYRICS } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { detailPaneKind, detailTabLabel } from './detailView.ts';

describe('detailTabLabel', () => {
  const lines = [{ timeSec: 1, text: 'a' }];

  it('is Lyrics while the song has lines', () => {
    expect(detailTabLabel(true, { ...NO_LYRICS, lines })).toBe('Lyrics');
    expect(detailTabLabel(false, { ...NO_LYRICS, lines })).toBe('Lyrics');
  });

  it('becomes Sections for an instrumental or a song with no lines', () => {
    expect(detailTabLabel(true, { ...NO_LYRICS, instrumental: true })).toBe(
      'Sections',
    );
    expect(detailTabLabel(true, NO_LYRICS)).toBe('Sections');
  });

  it('is absent when there is nothing to show', () => {
    expect(detailTabLabel(false, NO_LYRICS)).toBeNull();
  });
});

describe('detailPaneKind', () => {
  const lines = [{ timeSec: 1, text: 'a' }];

  it('picks stage lines for a song with times', () => {
    expect(detailPaneKind({ ...NO_LYRICS, lines, synced: true })).toBe('stage');
  });

  it('picks plain text when no line has a time', () => {
    expect(
      detailPaneKind({
        ...NO_LYRICS,
        lines: [{ timeSec: Infinity, text: 'a' }],
        plain: 'a',
      }),
    ).toBe('plain');
  });

  it('says so only for a song marked instrumental', () => {
    expect(detailPaneKind({ ...NO_LYRICS, instrumental: true })).toBe(
      'instrumental',
    );
    expect(detailPaneKind(NO_LYRICS)).toBe('none');
  });
});

import { describe, expect, it } from 'vitest';

import { cardMissingHints, internalOffer } from './cardMissing.ts';

const READY = { rootMissing: true, moveActive: false, importing: false };

describe('the Use internal storage offer', () => {
  it('is offered while the data folder’s card is out', () => {
    expect(internalOffer(READY)).toBe('offer');
  });

  it('waits while an import holds the folder', () => {
    expect(internalOffer({ ...READY, importing: true })).toBe('importing');
  });

  it('is not offered once the folder is back or already internal', () => {
    expect(internalOffer({ ...READY, rootMissing: false })).toBe('none');
  });

  it('is not offered while a move is unfinished', () => {
    expect(internalOffer({ ...READY, moveActive: true })).toBe('none');
  });
});

describe('the SD card not found hints', () => {
  it('names the card, then explains the choice when it is offered', () => {
    expect(cardMissingHints('SanDisk SD card', true)).toEqual([
      'Your song audio, stems and waveforms are on SanDisk SD card. Put the card back and they play again as they were. Nothing has been deleted.',
      'Or use internal storage for new songs from now on. The songs on the card stay listed until it’s back.',
    ]);
  });

  it('only explains reinserting when there is nothing to choose', () => {
    expect(cardMissingHints('the SD card', false)).toHaveLength(1);
  });
});

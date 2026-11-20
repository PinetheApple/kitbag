import type { DataFolderVolume } from '@kitbag/core-native';
import { DATA_FOLDER_CODES as CODES } from '@kitbag/core-state/src/dataFolder/codes.test-helper.ts';
import { describe, expect, it } from 'vitest';

import { CARD, GB, MB, move } from './dataFolderMove.test-helper.ts';
import {
  moveErrorText,
  movingHint,
  outcomeText,
  pausedHint,
  stopHint,
} from './dataFolderMoveText.ts';
import {
  CARD_BACK_TITLE,
  offerMovesValue,
  returnedRowValue,
  returnedStripDetail,
  returnNoSpaceHints,
  STILL_ON_CARD,
} from './returnedCardText.ts';

const PHASES = CODES.movePhases;

const RETURNED: DataFolderVolume = {
  volumeUuid: CARD,
  name: 'SanDisk SD card',
  state: 'mounted',
  inUse: false,
  freeBytes: 20 * GB,
  totalBytes: 64 * GB,
  awayFiles: 38,
  awayBytes: 840 * MB,
  awayRequiredBytes: 968 * MB,
  awaySongs: 12,
  awayStemSongs: 1,
};

const INTERNAL: DataFolderVolume = {
  ...RETURNED,
  volumeUuid: null,
  name: null,
  inUse: true,
  freeBytes: 610 * MB,
};

const RETURN = move({
  sourceVolumeUuid: CARD,
  targetVolumeUuid: null,
  doneBytes: 320 * MB,
  totalBytes: 840 * MB,
  doneFiles: 14,
  totalFiles: 38,
  cardReturn: true,
});

const ORDINARY = { ...RETURN, cardReturn: false };

describe('the returned card offer', () => {
  it('names the card and counts what is on it for each list', () => {
    expect(CARD_BACK_TITLE).toBe('SD card is back');
    expect(returnedStripDetail(RETURNED, 'songs')).toBe(
      '12 songs on it · 840 MB',
    );
    expect(returnedStripDetail(RETURNED, 'stems')).toBe(
      '1 stem song on it · 840 MB',
    );
    expect(
      returnedStripDetail({ ...RETURNED, awayStemSongs: 0 }, 'stems'),
    ).toBe('840 MB');
  });

  it('reads as one row in Settings counting every song', () => {
    expect(STILL_ON_CARD).toBe('Still on the SD card');
    expect(returnedRowValue(RETURNED)).toEqual({
      lead: '13 songs',
      detail: '· 840 MB',
      missing: false,
      highlighted: true,
    });
    expect(offerMovesValue(RETURNED)).toEqual(['840 MB', '· 13 songs']);
  });

  it('says how much to free when internal storage is short', () => {
    expect(returnNoSpaceHints(RETURNED, INTERNAL)).toEqual([
      'The card’s songs need 968 MB and internal storage has 610 MB free. Free up 358 MB to move them.',
      'Nothing has moved. They are still on the card and play from it.',
    ]);
  });

  it('gives a need, a free figure and a shortfall that add up', () => {
    const megabytes = (text: string) =>
      [...text.matchAll(/(\d+) MB/g)].map((match) => Number(match[1]));
    const [need = 0, free = 0, short] = megabytes(
      returnNoSpaceHints(RETURNED, INTERNAL)[0],
    );
    expect(need - free).toBe(short);
  });
});

describe('a move from a returned card', () => {
  it('asks to keep the card in while moving', () => {
    expect(movingHint(RETURN)).toBe(
      'The card’s songs keep playing from it until the move finishes. Keep the card in.',
    );
    expect(movingHint(ORDINARY)).toBe(
      'Every song keeps playing from the SD card until the move finishes.',
    );
  });

  it('says a stop removes internal copies and leaves the card as it is', () => {
    expect(stopHint(RETURN, PHASES)).toBe(
      'The 14 files already copied are removed from internal storage. The card’s songs stay on it and play from it, as now.',
    );
    expect(stopHint(ORDINARY, PHASES)).toContain('Everything stays on');
  });

  it('says what Undo removes when paused, and asks for the card once it is out', () => {
    const paused = { ...RETURN, running: false, paused: true };
    expect(pausedHint(paused, PHASES)).toBe(
      'Kitbag closed during the move. 14 of 38 files are on internal storage. The card’s songs still play from it. Undo removes the copies made so far from internal storage.',
    );
    expect(pausedHint(paused, PHASES, true)).toBe(
      'SD card taken out. 14 of 38 files are on internal storage. Put the card back to resume, or undo to remove those copies. Its songs play again once it’s in.',
    );
    expect(pausedHint({ ...paused, cardReturn: false }, PHASES, true)).toBe(
      'Kitbag closed during the move. 14 of 38 files are on internal storage. Your songs still play from the SD card.',
    );
  });

  it('says the card’s songs still play after a failure', () => {
    const places = { source: CARD, target: null, cardReturn: true };
    const mismatch = moveErrorText(
      CODES.moveErrors.hashMismatch,
      CODES,
      places,
    );
    expect(mismatch.body).toContain('The card’s songs still play from it.');
    expect(mismatch.body).not.toContain('Every song');
    const ordinary = moveErrorText(CODES.moveErrors.hashMismatch, CODES, {
      ...places,
      cardReturn: false,
    });
    expect(ordinary.body).toContain('Every song still plays from the SD card.');
  });

  it('confirms the songs left the card when it finishes', () => {
    const done = { outcome: CODES.moveOutcomes.done, error: null, path: null };
    expect(
      outcomeText(done, CODES, {
        source: CARD,
        target: null,
        cardReturn: true,
      }),
    ).toBe(
      'Move finished. The card’s songs now play from internal storage and are off the card.',
    );
    expect(outcomeText(done, CODES, { source: CARD, target: null })).toBe(
      'Move finished. Your files are on internal storage.',
    );
  });
});

import { KB_RESULT } from '@kitbag/core-native';
import { stem } from '@kitbag/core-state/src/stemPlayer/store.test-helper.ts';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  mountPlayer,
  SET_ID,
  SONG_DETAILS,
  STEMS,
  type Player,
} from './playerHarness.test-helper.tsx';

type StoredStem = ReturnType<typeof stem>;

const BARS = 8;
const FAILED = KB_RESULT.KB_ERROR_INVALID_ARGUMENT;
const THREE_STEMS = [stem(1), stem(2), stem(3)];
const ALL_MISSING = 'No stem files could be opened. Nothing will play.';

let player: Player | undefined;

afterEach(() => {
  player?.store.getState().close();
  player?.unmount();
  player = undefined;
});

async function openedWith(
  failing: number,
  stems: readonly StoredStem[] = STEMS,
): Promise<Player> {
  const p = await mountPlayer(SONG_DETAILS, stems);
  player = p;
  p.commands.loadTrack.mockImplementation((track) =>
    Promise.resolve(track < failing ? FAILED : KB_RESULT.KB_OK),
  );
  const { open } = p.store.getState();
  await act(() => open(SET_ID, BARS));
  return p;
}

describe('the Stems missing card', () => {
  it.each([
    [1, '1 stem file could not be opened. The others play.'],
    [2, '2 stem files could not be opened. The others play.'],
  ])(
    'says the others play when %i of the stems are missing',
    async (failing, note) => {
      const p = await openedWith(failing, THREE_STEMS);
      expect(p.labelled('Stems missing')).toHaveLength(1);
      expect(p.has(note)).toBe(true);
      expect(p.has(ALL_MISSING)).toBe(false);
    },
  );

  it('says nothing will play when every stem is missing', async () => {
    const p = await openedWith(STEMS.length);
    expect(p.labelled('Stems missing')).toHaveLength(1);
    expect(p.has(ALL_MISSING)).toBe(true);
    expect(p.texts().some((text) => text.includes('The others play.'))).toBe(
      false,
    );
  });
});

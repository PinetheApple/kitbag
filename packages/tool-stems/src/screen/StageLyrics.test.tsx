import { stemSections } from '@kitbag/core-design';
import { afterEach, describe, expect, it } from 'vitest';

import {
  fireLayout,
  mountPlayer,
  SONG_DETAILS,
  withTestId,
  type Player,
} from './playerHarness.test-helper.tsx';

let player: Player | undefined;

const row = (p: Player, testID: string) => withTestId(p, testID)[0];

afterEach(() => {
  player?.unmount();
  player = undefined;
});

describe('following a seek with no current line', () => {
  const TRAILING_BLANK = {
    synced: '[00:01.00]One\n[00:03.00]\n[00:05.00]Two\n[00:07.00]',
    plain: null,
    offsetSec: 0,
    instrumental: false,
  };

  async function laidOut() {
    const p = await mountPlayer({ ...SONG_DETAILS, lyrics: TRAILING_BLANK });
    player = p;
    await p.press('Lyrics');
    fireLayout(row(p, 'stage-lyrics'), { height: 300 });
    fireLayout(row(p, 'lyric-line-0'), { y: 100 });
    fireLayout(row(p, 'lyric-line-2'), { y: 700 });
    p.scrolls.mockClear();
    return p;
  }
  const placed = (y: number) => ({
    y: y - 300 * stemSections.followAtFraction,
    animated: true,
  });

  it('scrolls to the next line from a gap after a blank line', async () => {
    const p = await laidOut();
    p.frames(4);
    expect(p.scrolls).toHaveBeenLastCalledWith(placed(700));
  });

  it('scrolls to the last sung line past the end of the lyrics', async () => {
    const p = await laidOut();
    p.frames(8);
    expect(p.scrolls).toHaveBeenLastCalledWith(placed(700));
  });

  it('scrolls to the top before the first line', async () => {
    const p = await laidOut();
    p.frames(8);
    p.frames(0.5);
    expect(p.scrolls).toHaveBeenLastCalledWith({ y: 0, animated: true });
  });

  it('corrects the place when the target row moves after the seek', async () => {
    const p = await laidOut();
    p.frames(4);
    fireLayout(row(p, 'lyric-line-2'), { y: 650 });
    expect(p.scrolls).toHaveBeenLastCalledWith(placed(650));
  });

  it('leaves a row that is not the target alone as it lays out', async () => {
    const p = await laidOut();
    p.frames(4);
    p.scrolls.mockClear();
    fireLayout(row(p, 'lyric-line-0'), { y: 120 });
    expect(p.scrolls).not.toHaveBeenCalled();
  });
});

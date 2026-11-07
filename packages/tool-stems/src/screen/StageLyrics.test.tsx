import { stemSections } from '@kitbag/core-design';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  mountPlayer,
  SONG_DETAILS,
  type Player,
} from './playerHarness.test-helper.tsx';

let player: Player | undefined;

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
    const fire = (testID: string, layout: object) => {
      const [node] = p.renderer.root.findAll(
        (n) => typeof n.type === 'string' && n.props.testID === testID,
      );
      act(() => {
        (node?.props.onLayout as (e: unknown) => void)({
          nativeEvent: { layout },
        });
      });
    };
    fire('stage-lyrics', { height: 300 });
    fire('lyric-line-0', { y: 100 });
    fire('lyric-line-2', { y: 700 });
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
    const [row] = p.renderer.root.findAll(
      (n) => typeof n.type === 'string' && n.props.testID === 'lyric-line-2',
    );
    act(() => {
      (row?.props.onLayout as (e: unknown) => void)({
        nativeEvent: { layout: { y: 650 } },
      });
    });
    expect(p.scrolls).toHaveBeenLastCalledWith(placed(650));
  });

  it('leaves a row that is not the target alone as it lays out', async () => {
    const p = await laidOut();
    p.frames(4);
    p.scrolls.mockClear();
    const [row] = p.renderer.root.findAll(
      (n) => typeof n.type === 'string' && n.props.testID === 'lyric-line-0',
    );
    act(() => {
      (row?.props.onLayout as (e: unknown) => void)({
        nativeEvent: { layout: { y: 120 } },
      });
    });
    expect(p.scrolls).not.toHaveBeenCalled();
  });
});

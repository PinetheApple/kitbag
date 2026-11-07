import { stemPlayer } from '@kitbag/core-design';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { animatedStyleOf } from '../testing/reanimatedDriver.ts';
import { mountPlayer, type Player } from './playerHarness.test-helper.tsx';

let player: Player | undefined;

async function open(tab: string | null = null) {
  player = await mountPlayer();
  if (tab !== null) await player.press(tab);
  return player;
}

function withTestId(p: Player, testID: string) {
  return p.renderer.root.findAll(
    (node) => typeof node.type === 'string' && node.props.testID === testID,
  );
}

function liveStyle(p: Player, testID: string) {
  const [node] = withTestId(p, testID);
  return animatedStyleOf(node?.props.style);
}

afterEach(() => {
  player?.unmount();
  player = undefined;
});

describe('the scrub lane', () => {
  it('notches each section boundary inside the song', async () => {
    const p = await open();
    const lefts = withTestId(p, 'section-notch').map(
      (node) => (node.props.style as { left?: string }[])[1]?.left,
    );
    expect(lefts).toEqual(['40%', '80%']);
  });

  it('tints the section under the playhead', async () => {
    const p = await open();
    p.frames(5);
    expect(liveStyle(p, 'section-tint')).toEqual({
      opacity: 1,
      left: '40%',
      width: '40%',
    });
  });

  it('moves the tint across a boundary with no render', async () => {
    const p = await open();
    p.frames(5);
    p.commit.mockClear();
    p.frames(9);
    expect(p.commit).not.toHaveBeenCalled();
    expect(liveStyle(p, 'section-tint')).toMatchObject({ left: '80%' });
  });

  it('cuts the tint at the song end', async () => {
    const p = await open();
    p.frames(9);
    expect(liveStyle(p, 'section-tint')).toMatchObject({ width: '20%' });
  });
});

describe('the loop note', () => {
  const FLAGGED_LATE = 'Loop Outro, 0:08 to 0:12';

  function layout(node: { props: Record<string, unknown> }, box: object) {
    act(() => {
      (node.props.onLayout as (e: unknown) => void)({
        nativeEvent: { layout: box },
      });
    });
  }

  function only(p: Player, testID: string) {
    const [node] = withTestId(p, testID);
    if (node === undefined) throw new Error(testID);
    return node;
  }

  function measured(p: Player, noteWidth: number, noteHeight: number) {
    layout(only(p, 'scrub-lane'), { width: 328 });
    layout(only(p, 'scrub-bar'), { x: 82, width: 164 });
    layout(only(p, 'loop-note'), { width: noteWidth, height: noteHeight });
  }

  const flat = (node: { props: Record<string, unknown> }) =>
    Object.assign({}, ...[node.props.style].flat(2)) as Record<string, unknown>;

  it('stands on its own row, clear of the flags, when no side fits', async () => {
    const p = await open('Lyrics');
    await p.press(FLAGGED_LATE);
    measured(p, 234, 30);
    const riseToFlag = -(stemPlayer.loopTintInset + stemPlayer.loopFlagTop);
    expect(flat(only(p, 'scrub-lane')).paddingTop).toBe(
      stemPlayer.loopNoteTop + 30 + riseToFlag,
    );
    expect(flat(only(p, 'loop-note')).right).toBe(0);
  });

  it('moves to the left of a late loop when it fits there', async () => {
    const p = await open('Lyrics');
    await p.press(FLAGGED_LATE);
    measured(p, 60, 16);
    const note = flat(only(p, 'loop-note'));
    expect(note.left).toBe(0);
    expect(note.right).toBeUndefined();
    expect(flat(only(p, 'scrub-lane')).paddingTop).toBe(stemPlayer.laneTop);
  });

  it('never renders for the playhead, only for the loop', async () => {
    const p = await open('Lyrics');
    await p.press(FLAGGED_LATE);
    measured(p, 60, 16);
    p.frames(9);
    p.commit.mockClear();
    p.frames(9.5);
    p.frames(9.9);
    expect(p.commit).not.toHaveBeenCalled();
    expect(flat(only(p, 'loop-note')).left).toBe(0);
  });
});

describe('the current card', () => {
  it('fills by how far the playhead is through the section', async () => {
    const p = await open('Lyrics');
    p.frames(5);
    expect(withTestId(p, 'section-progress')).toHaveLength(1);
    expect(liveStyle(p, 'section-progress')).toEqual({ width: '25%' });
    p.frames(7);
    expect(liveStyle(p, 'section-progress')).toEqual({ width: '75%' });
  });
});

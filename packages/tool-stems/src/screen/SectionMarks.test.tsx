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

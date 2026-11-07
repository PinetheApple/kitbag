import { space } from '@kitbag/core-design';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  mountPlayer,
  SET_ID,
  type Player,
} from './playerHarness.test-helper.tsx';

const BARS = 8;

let player: Player | undefined;

type Node = ReturnType<Player['textNode']>;

function insetsAbove(node: Node): unknown[] {
  const insets: unknown[] = [];
  for (let at = node?.parent; at; at = at.parent) {
    if (typeof at.type !== 'string') continue;
    const raw: unknown = at.props.style;
    const style = Object.assign({}, ...[raw].flat(Infinity)) as {
      paddingHorizontal?: unknown;
    };
    insets.push(style.paddingHorizontal);
  }
  return insets;
}

afterEach(() => {
  player?.store.getState().close();
  player?.unmount();
  player = undefined;
  vi.restoreAllMocks();
});

describe('a stem song that does not open', () => {
  it.each([
    ['failed', 'These stems would not open', () => Promise.reject(new Error('locked'))],
    ['missing', 'This stem song is gone', () => Promise.resolve(undefined)],
  ] as const)('gives the %s box the screen inset', async (status, title, read) => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    player = await mountPlayer();
    player.records.readStemSet.mockImplementationOnce(read);
    const { open } = player.store.getState();
    await act(() => open(SET_ID, BARS));
    expect(player.store.getState().status).toBe(status);
    expect(insetsAbove(player.textNode(title))).toContain(space.screenInset);
  });
});

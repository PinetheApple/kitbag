// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { PLAYER_SCROLL_ID, QUEUE_TEXT, stemPlayer } from '@kitbag/core-design';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';

import { AdvanceCountIn } from '@kitbag/tool-stems/src/screen/AdvanceCountIn.tsx';
import { LYRIC_FLOOR, LYRIC_SLOT_ID } from '@kitbag/tool-stems/src/screen/DetailPane.tsx';
import { OVERLAY_ID } from '@kitbag/tool-stems/src/screen/PlayerLayouts.tsx';
import {
  mountTracked,
  PLAIN_LYRICS,
  retiming,
  SONG_DETAILS,
  unmountTracked,
  withTestId,
  type Player,
} from './playerHarness.test-helper.tsx';
import { MIN_VISIBLE_STEMS, MIXER_FLOOR, MIXER_SLOT_ID } from '@kitbag/tool-stems/src/screen/StemList.tsx';

afterEach(unmountTracked);

function only(p: Player, testID: string): ReactTestInstance {
  const [node] = withTestId(p, testID);
  if (node === undefined) throw new Error(`nothing has testID ${testID}`);
  return node;
}

const styleOf = (node: ReactTestInstance) =>
  Object.assign(
    {},
    ...([node.props.style].flat(Infinity) as object[]),
  ) as Record<string, unknown>;

// Yoga measures a slot's content when the page height is open, so only an
// out-of-flow child keeps a long list from growing the page.
const inFlowChildren = (slot: ReactTestInstance) =>
  slot.children.filter(
    (child) =>
      typeof child !== 'string' && styleOf(child).position !== 'absolute',
  );

const holds = (
  box: ReactTestInstance,
  test: (n: ReactTestInstance) => boolean,
) => box.findAll(test).length > 0;

describe('the stem player below its app bar', () => {
  it('holds the mixer and the dock in one scroll', async () => {
    const scroll = only(await mountTracked(), PLAYER_SCROLL_ID);
    expect(holds(scroll, (n) => n.props.testID === MIXER_SLOT_ID)).toBe(true);
    expect(
      holds(scroll, (n) => n.props.accessibilityLabel === QUEUE_TEXT.previous),
    ).toBe(true);
  });

  it('keeps the mixer floor of two stem rows', async () => {
    const slot = styleOf(only(await mountTracked(), MIXER_SLOT_ID));
    expect(slot.minHeight).toBe(MIXER_FLOOR);
    expect(MIXER_FLOOR).toBeGreaterThanOrEqual(
      MIN_VISIBLE_STEMS * stemPlayer.rowHeight,
    );
  });

  it('keeps a long mixer out of the page height, so a roomy window does not scroll', async () => {
    const slot = only(await mountTracked(), MIXER_SLOT_ID);
    expect(inFlowChildren(slot)).toEqual([]);
  });

  it('lays its count-in and snackbars over the scroll, not inside it', async () => {
    const p = await mountTracked();
    const overlay = only(p, OVERLAY_ID);
    expect(holds(overlay, (n) => n.type === AdvanceCountIn)).toBe(true);
    expect(
      holds(only(p, PLAYER_SCROLL_ID), (n) => n.props.testID === OVERLAY_ID),
    ).toBe(false);
  });
});

describe('the lyrics on the Details tab', () => {
  it.each([
    ['synced', SONG_DETAILS],
    ['plain', { ...SONG_DETAILS, lyrics: PLAIN_LYRICS }],
  ])('keep a floor of lyric lines when %s', async (_kind, song) => {
    const p = await mountTracked(song);
    await p.press('Lyrics');
    const slot = only(p, LYRIC_SLOT_ID);
    expect(styleOf(slot).minHeight).toBe(LYRIC_FLOOR);
    expect(inFlowChildren(slot)).toEqual([]);
    const [lyrics] = slot.findAll((n) => String(n.type) === 'ScrollView');
    expect(lyrics?.props.nestedScrollEnabled).toBe(true);
  });
});

describe('the stem player while retiming', () => {
  it('pins its layout with no scroll around the pad', async () => {
    const p = await retiming();
    expect(withTestId(p, PLAYER_SCROLL_ID)).toEqual([]);
    expect(withTestId(p, OVERLAY_ID)).toHaveLength(1);
  });
});

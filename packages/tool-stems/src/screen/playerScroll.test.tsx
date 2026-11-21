// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { PLAYER_SCROLL_ID, QUEUE_TEXT, stemPlayer } from '@kitbag/core-design';
import { act } from 'react';
import type { ReactTestInstance } from 'react-test-renderer';
import { afterEach, describe, expect, it } from 'vitest';

import { display } from '../testing/reactNativeHosts.ts';
import {
  mountTracked,
  unmountTracked,
  withTestId,
  type Player,
} from './playerHarness.test-helper.tsx';
import { MIXER_SLOT_ID } from './StemList.tsx';

const MIN_STEM_ROWS = 2;
const SHORT_WINDOW = { viewport: 380, content: 520 };
const PHONE_WINDOW = { viewport: 690, content: 690 };
const FONT_SCALES = [1, 2];

afterEach(() => {
  display.fontScale = 1;
  unmountTracked();
});

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

function measure(
  scroll: ReactTestInstance,
  window: { viewport: number; content: number },
) {
  act(() => {
    (scroll.props.onLayout as (event: unknown) => void)({
      nativeEvent: { layout: { height: window.viewport } },
    });
    (scroll.props.onContentSizeChange as (w: number, h: number) => void)(
      0,
      window.content,
    );
  });
}

describe.each(FONT_SCALES)('the stem player at font scale %s', (fontScale) => {
  async function mounted() {
    display.fontScale = fontScale;
    return mountTracked();
  }

  it('holds the mixer and the dock in one scroll below the app bar', async () => {
    const p = await mounted();
    const scroll = only(p, PLAYER_SCROLL_ID);
    const inside = (test: (node: ReactTestInstance) => boolean) =>
      scroll.findAll(test).length > 0;
    expect(inside((node) => node.props.testID === MIXER_SLOT_ID)).toBe(true);
    expect(
      inside((node) => node.props.accessibilityLabel === QUEUE_TEXT.previous),
    ).toBe(true);
  });

  it('keeps room for two stem rows however short the window', async () => {
    const slot = styleOf(only(await mounted(), MIXER_SLOT_ID));
    expect(slot.flexShrink).toBe(0);
    expect(slot.flexBasis).toBeGreaterThanOrEqual(
      MIN_STEM_ROWS * stemPlayer.rowHeight,
    );
  });

  it('scrolls as one when the floor and the dock overflow a short window', async () => {
    const scroll = only(await mounted(), PLAYER_SCROLL_ID);
    measure(scroll, SHORT_WINDOW);
    expect(scroll.props.scrollEnabled).toBe(true);
  });

  it('stays put when everything fits', async () => {
    const scroll = only(await mounted(), PLAYER_SCROLL_ID);
    measure(scroll, PHONE_WINDOW);
    expect(scroll.props.scrollEnabled).toBe(false);
  });
});

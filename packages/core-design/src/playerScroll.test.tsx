// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import { create } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import {
  contentOverflows,
  usePlayerScroll,
  type PlayerScrollState,
} from './playerScroll.ts';

const SHORT_WINDOW = { viewport: 380, content: 520 };
const FULL_WINDOW = { viewport: 690, content: 690 };
const SUBPIXEL = 0.3;

function mounted() {
  let state: PlayerScrollState | undefined;
  function Probe() {
    state = usePlayerScroll();
    return null;
  }
  act(() => {
    create(createElement(Probe));
  });
  const enabled = () => state?.scrollEnabled;
  const measure = (window: { viewport: number; content: number }) => {
    act(() => {
      state?.onLayout({
        nativeEvent: {
          layout: { x: 0, y: 0, width: 0, height: window.viewport },
        },
      } as Parameters<PlayerScrollState['onLayout']>[0]);
      state?.onContentSizeChange(0, window.content);
    });
    return enabled();
  };
  return { measure, enabled };
}

describe('contentOverflows', () => {
  it('does not overflow before the content is measured', () => {
    expect(contentOverflows(FULL_WINDOW.viewport, 0)).toBe(false);
  });

  it('overflows measured content against an unmeasured viewport', () => {
    expect(contentOverflows(0, FULL_WINDOW.content)).toBe(true);
  });
});

describe('usePlayerScroll', () => {
  it('stays put before anything is measured', () => {
    expect(mounted().enabled()).toBe(false);
  });

  it('scrolls when the content overflows a short window', () => {
    expect(mounted().measure(SHORT_WINDOW)).toBe(true);
  });

  it('stays put when the content fills the window exactly', () => {
    expect(mounted().measure(FULL_WINDOW)).toBe(false);
  });

  it('ignores a sub-pixel difference from layout rounding', () => {
    const { measure } = mounted();
    expect(
      measure({
        viewport: FULL_WINDOW.viewport,
        content: FULL_WINDOW.content + SUBPIXEL,
      }),
    ).toBe(false);
  });

  it('stops scrolling once the content fits again', () => {
    const { measure } = mounted();
    measure(SHORT_WINDOW);
    expect(measure(FULL_WINDOW)).toBe(false);
  });
});

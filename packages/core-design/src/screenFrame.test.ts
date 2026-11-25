import { describe, expect, it } from 'vitest';

import { screenFrameInsets } from './screenFrame.ts';

const INSETS = { top: 24, bottom: 16 };

describe('screenFrameInsets', () => {
  it('pads the status bar and the navigation bar on the frame', () => {
    expect(screenFrameInsets(INSETS)).toEqual({
      paddingTop: INSETS.top,
      paddingBottom: INSETS.bottom,
    });
  });

  it('leaves the navigation bar to a dock drawn below the content', () => {
    expect(screenFrameInsets(INSETS, { dockBelow: true })).toEqual({
      paddingTop: INSETS.top,
      paddingBottom: 0,
    });
  });

  it('pads the navigation bar when the dock is absent', () => {
    expect(screenFrameInsets(INSETS, { dockBelow: false }).paddingBottom).toBe(
      INSETS.bottom,
    );
  });
});

import { space } from '@kitbag/core-design';
import { createElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  contentStyle,
  itKeepsSafeAreaInsetsOutOfTheScroll,
  renderRecorded,
} from '../safeAreaInsets.test-helper.ts';

import type { SettingsFrameProps } from './SettingsFrame.tsx';

vi.mock(
  'react-native',
  async () =>
    (await import('../safeAreaInsets.test-helper.ts')).reactNativeMock,
);

vi.mock(
  'react-native-safe-area-context',
  async () =>
    (await import('../safeAreaInsets.test-helper.ts')).safeAreaContextMock,
);

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  AppBar: () => null,
  createThemedStyles: (await import('../safeAreaInsets.test-helper.ts'))
    .createThemedStylesMock,
}));

const { SettingsFrame } = await import('./SettingsFrame.tsx');

const FRAME_PROPS: SettingsFrameProps = {
  title: 'Settings',
  onBack: () => undefined,
  children: null,
};

function render(props: SettingsFrameProps = FRAME_PROPS) {
  renderRecorded(createElement(SettingsFrame, props));
}

beforeEach(() => {
  render();
});

describe('SettingsFrame safe-area insets', () => {
  itKeepsSafeAreaInsetsOutOfTheScroll(space.screenInset);

  it('still stretches the scrolling content to the viewport when filling the screen', () => {
    render({ ...FRAME_PROPS, fillScreen: true });
    expect(contentStyle().flexGrow).toBe(1);
  });
});

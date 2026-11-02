import { space } from '@kitbag/core-design';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SettingsFrameProps } from './SettingsFrame.tsx';

type Style = Record<string, unknown>;
type StyleProp = Style | false | null | undefined | readonly StyleProp[];
type Props = Record<string, unknown> & { readonly children?: ReactNode };

const STATUS_BAR = 24;
const NAV_BAR = 16;
const BG = 'screen-bg';

interface Rendered {
  readonly kind: 'View' | 'ScrollView';
  readonly props: Props;
}

const rendered = vi.hoisted(() => [] as Rendered[]);

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  return {
    View: (props: Props) => {
      rendered.push({ kind: 'View', props });
      return h('div', null, props.children);
    },
    ScrollView: (props: Props) => {
      rendered.push({ kind: 'ScrollView', props });
      return h('div', null, props.children);
    },
  };
});

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: STATUS_BAR,
    bottom: NAV_BAR,
    left: 0,
    right: 0,
  }),
}));

vi.mock('@kitbag/core-design', async (original) => {
  const pure = await original<Record<string, unknown>>();
  return {
    ...pure,
    AppBar: () => null,
    createThemedStyles:
      (factory: (theme: unknown) => Record<string, Style>) => () =>
        factory({ color: { bg: BG } }),
  };
});

const { SettingsFrame } = await import('./SettingsFrame.tsx');

const FRAME_PROPS: SettingsFrameProps = {
  title: 'Settings',
  onBack: () => undefined,
  children: null,
};

function flatten(style: StyleProp): Style {
  if (Array.isArray(style)) {
    return (style as readonly StyleProp[]).reduce<Style>(
      (merged, s) => ({ ...merged, ...flatten(s) }),
      {},
    );
  }
  return style ? (style as Style) : {};
}

function render(props: SettingsFrameProps = FRAME_PROPS) {
  rendered.length = 0;
  renderToStaticMarkup(createElement(SettingsFrame, props));
}

function scrollView(): Rendered {
  const found = rendered.find((r) => r.kind === 'ScrollView');
  if (found === undefined) throw new Error('no ScrollView rendered');
  return found;
}

function contentStyle(): Style {
  return flatten(scrollView().props.contentContainerStyle as StyleProp);
}

beforeEach(() => {
  render();
});

describe('SettingsFrame safe-area insets', () => {
  it('keeps the status bar inset out of the scrolling content', () => {
    expect(contentStyle().paddingTop).toBe(space.screenInset);
  });

  it('pads the status bar on a non-scrolling container painted with the screen background', () => {
    const scrollIndex = rendered.indexOf(scrollView());
    const frame = rendered
      .slice(0, scrollIndex)
      .map((r) => flatten(r.props.style as StyleProp))
      .find((s) => s.paddingTop === STATUS_BAR);
    expect(frame?.backgroundColor).toBe(BG);
  });

  it('keeps the navigation bar inset at the end of the scrolling content', () => {
    expect(contentStyle().paddingBottom).toBe(space.screenInset + NAV_BAR);
  });

  it('still stretches the scrolling content to the viewport when filling the screen', () => {
    render({ ...FRAME_PROPS, fillScreen: true });
    expect(contentStyle().flexGrow).toBe(1);
  });
});

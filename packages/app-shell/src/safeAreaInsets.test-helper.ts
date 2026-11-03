import { createElement, type ReactElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';

type Style = Record<string, unknown>;
type StyleProp = Style | false | null | undefined | readonly StyleProp[];
type Props = Record<string, unknown> & { readonly children?: ReactNode };

export const STATUS_BAR = 24;
export const NAV_BAR = 16;
export const BG = 'screen-bg';

interface Rendered {
  readonly kind: 'View' | 'ScrollView';
  readonly props: Props;
}

const rendered: Rendered[] = [];

function recording(kind: Rendered['kind']) {
  return function Recorded(props: Props) {
    rendered.push({ kind, props });
    return createElement('div', null, props.children);
  };
}

export const reactNativeMock = {
  View: recording('View'),
  ScrollView: recording('ScrollView'),
};

export const safeAreaContextMock = {
  useSafeAreaInsets: () => ({
    top: STATUS_BAR,
    bottom: NAV_BAR,
    left: 0,
    right: 0,
  }),
};

export const createThemedStylesMock =
  (factory: (theme: unknown) => Record<string, Style>) => () =>
    factory({ color: { bg: BG } });

export function renderRecorded(element: ReactElement): void {
  rendered.length = 0;
  renderToStaticMarkup(element);
}

function flatten(style: StyleProp): Style {
  if (Array.isArray(style)) {
    return (style as readonly StyleProp[]).reduce<Style>(
      (merged, s) => ({ ...merged, ...flatten(s) }),
      {},
    );
  }
  return style ? (style as Style) : {};
}

function scrollView(): Rendered {
  const found = rendered.find((r) => r.kind === 'ScrollView');
  if (found === undefined) throw new Error('no ScrollView rendered');
  return found;
}

export function contentStyle(): Style {
  return flatten(scrollView().props.contentContainerStyle as StyleProp);
}

function frameStyle(): Style | undefined {
  return rendered
    .slice(0, rendered.indexOf(scrollView()))
    .map((r) => flatten(r.props.style as StyleProp))
    .find((s) => s.paddingTop === STATUS_BAR);
}

export function itKeepsSafeAreaInsetsOutOfTheScroll(screenInset: number): void {
  it('keeps the status bar inset out of the scrolling content, so its bar sits flush under it', () => {
    expect(contentStyle().paddingTop ?? 0).toBe(0);
  });

  it('pads the status bar on a non-scrolling container painted with the screen background', () => {
    expect(frameStyle()?.backgroundColor).toBe(BG);
  });

  it('keeps the navigation bar inset at the end of the scrolling content', () => {
    expect(contentStyle().paddingBottom).toBe(screenInset + NAV_BAR);
  });

  it('lets the inset frame and its scroll view fill the screen', () => {
    expect(frameStyle()?.flex).toBe(1);
    expect(flatten(scrollView().props.style as StyleProp).flex).toBe(1);
  });
}

import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { iconSizes, screenBar, size } from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const BADGE = '1';
const GROWN_FONT_SCALE = 2;
const noop = () => undefined;

const display = vi.hoisted(() => ({ fontScale: 1 }));
const icons = vi.hoisted(() => [] as Props[]);
const texts = vi.hoisted(() => [] as Props[]);
const views = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (importOriginal) => {
  const { createElement: h } = await import('react');
  const actual = await importOriginal<typeof import('react-native')>();
  return {
    ...actual,
    useWindowDimensions: () => ({ fontScale: display.fontScale, scale: 1 }),
    Text: (props: Props) => {
      texts.push(props);
      return h('span', null, props.children);
    },
    View: (props: Props) => {
      views.push(props);
      return h('div', null, props.children);
    },
  };
});

vi.mock('./Icon.tsx', () => ({
  Icon: (props: Props) => {
    icons.push(props);
    return null;
  },
}));

const { BarIconButton } = await import('./AppBar.tsx');
const { KeyBadge } = await import('./KeyBadge.tsx');

const styleOf = (view: Props) => flatStyle(view.style as StyleProp<ViewStyle>);

function drawBarBadge(fontScale: number) {
  display.fontScale = fontScale;
  icons.length = 0;
  texts.length = 0;
  views.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <BarIconButton icon="queue" label="Queue" badge={BADGE} onPress={noop} />
    </ThemeProvider>,
  );
  display.fontScale = 1;
  const label = texts.find((text) => text.children === BADGE);
  const badge = views.find((view) => styleOf(view).position === 'absolute');
  return {
    label,
    iconScale: Number(icons[0]?.scale),
    box: badge === undefined ? {} : styleOf(badge),
  };
}

// The badge's overlap with the icon, as shares of the icon's size.
function overlapShares(fontScale: number) {
  const { iconScale, box } = drawBarBadge(fontScale);
  const iconPx = iconSizes.bar * iconScale;
  const iconInset = (screenBar.iconButton - iconPx) / 2;
  const top = Number(box.top);
  const right = Number(box.right);
  const side = Number(box.minHeight);
  return {
    down: (top + side - iconInset) / iconPx,
    across: (right + side - iconInset) / iconPx,
  };
}

describe('the bar key badge under font scale', () => {
  it('grows no further than the icon it sits on', () => {
    const { label, iconScale } = drawBarBadge(GROWN_FONT_SCALE);
    expect(label?.maxFontSizeMultiplier).toBe(iconScale);
  });

  it('covers the same share of the grown icon as of the design icon', () => {
    const design = overlapShares(1);
    const grown = overlapShares(GROWN_FONT_SCALE);
    expect(grown.down).toBeCloseTo(design.down);
    expect(grown.across).toBeCloseTo(design.across);
  });
});

it('keeps a badge at design size beside a glyph that does not grow', () => {
  display.fontScale = GROWN_FONT_SCALE;
  texts.length = 0;
  views.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <KeyBadge label={BADGE} style={null} />
    </ThemeProvider>,
  );
  display.fontScale = 1;
  const label = texts.find((text) => text.children === BADGE);
  expect(label?.maxFontSizeMultiplier).toBe(1);
  expect(views[0] === undefined ? undefined : styleOf(views[0]).minHeight).toBe(
    size.keyBadge,
  );
});

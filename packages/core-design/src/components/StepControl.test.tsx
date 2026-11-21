import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { size, space } from '../roles.ts';
import { textIconScale } from '../textScale.ts';
import { themes } from '../theme.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { StepControl, type StepControlVariant } from './StepControl.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const SUFFIX = 'bar';
const display = vi.hoisted(() => ({ fontScale: 1 }));
const suffixes = vi.hoisted(() => [] as Props[]);
const views = vi.hoisted(() => [] as Props[]);
const glyphs = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement } = await import('react');
  const Text = actual.Text as (props: Props) => ReactNode;
  const View = actual.View as (props: Props) => ReactNode;
  return {
    ...actual,
    View: (props: Props) => {
      views.push(props);
      return createElement(View, props);
    },
    useWindowDimensions: () => ({ fontScale: display.fontScale }),
    Text: (props: Props) => {
      if (props.children === SUFFIX) suffixes.push(props);
      return createElement(Text, props);
    },
  };
});

vi.mock('./IconGlyph.tsx', () => ({
  InlineIcon: (props: Props) => {
    glyphs.push(props);
    return null;
  },
}));

function suffixGapAt(fontScale: number): unknown {
  display.fontScale = fontScale;
  suffixes.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <StepControl
        variant="inlineLargeTextGlyph"
        label="Against"
        value="4"
        suffix={SUFFIX}
        onStep={vi.fn()}
        onValuePress={vi.fn()}
      />
    </ThemeProvider>,
  );
  return flatStyle(suffixes[0]?.style as StyleProp<TextStyle>).marginLeft;
}

describe('StepControl suffix under font scale', () => {
  it('keeps the design gap at the default text size', () => {
    expect(suffixGapAt(1)).toBe(space.stepSuffixGap);
  });

  it('grows the gap with the text so the value and suffix stay apart', () => {
    expect(suffixGapAt(2)).toBe(space.stepSuffixGap * 2);
  });
});

describe('StepControl accented inline', () => {
  function clusterStyle(accented: boolean): ViewStyle {
    views.length = 0;
    renderToStaticMarkup(
      <ThemeProvider mode="dark">
        <StepControl
          variant="inlineLarge"
          label="Speed"
          value="75%"
          accented={accented}
          onStep={vi.fn()}
        />
      </ThemeProvider>,
    );
    return flatStyle(views[0]?.style as StyleProp<ViewStyle>);
  }

  it('takes the active fill and border only when accented', () => {
    const { activeControlFill, color } = themes.dark;
    expect(clusterStyle(true)).toMatchObject({
      backgroundColor: activeControlFill,
      borderColor: color.accentDim,
    });
    expect(clusterStyle(false).backgroundColor).toBe(color.surface2);
  });
});

describe('StepControl key glyphs under font scale', () => {
  function glyphSizeAt(variant: StepControlVariant, fontScale: number) {
    display.fontScale = fontScale;
    glyphs.length = 0;
    renderToStaticMarkup(
      <ThemeProvider mode="dark">
        <StepControl
          variant={variant}
          label="Ramp to"
          value="120"
          onStep={vi.fn()}
        />
      </ThemeProvider>,
    );
    display.fontScale = 1;
    return Number(flatStyle(glyphs[0]?.style as StyleProp<TextStyle>).fontSize);
  }

  it.each(['inline', 'inlineLarge', 'inlineLargeTextGlyph'] as const)(
    'grows the %s glyphs like other icons beside text',
    (variant) => {
      expect(glyphSizeAt(variant, 2)).toBe(
        glyphSizeAt(variant, 1) * textIconScale(2),
      );
    },
  );

  it.each(['inlineLarge', 'inlineLargeTextGlyph'] as const)(
    'keeps the grown %s glyph inside its fixed-width key',
    (variant) => {
      expect(glyphSizeAt(variant, 2)).toBeLessThanOrEqual(
        size.stepInlineLargeKey,
      );
    },
  );
});

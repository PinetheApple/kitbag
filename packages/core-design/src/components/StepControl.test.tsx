import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, TextStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { space } from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { StepControl } from './StepControl.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const SUFFIX = 'bar';
const display = vi.hoisted(() => ({ fontScale: 1 }));
const suffixes = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement } = await import('react');
  const Text = actual.Text as (props: Props) => ReactNode;
  return {
    ...actual,
    useWindowDimensions: () => ({ fontScale: display.fontScale }),
    Text: (props: Props) => {
      if (props.children === SUFFIX) suffixes.push(props);
      return createElement(Text, props);
    },
  };
});

vi.mock('./IconGlyph.tsx', () => ({ InlineIcon: () => null }));

const { StyleSheet } = await import('react-native');

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
  return StyleSheet.flatten(suffixes[0]?.style as StyleProp<TextStyle>)
    .marginLeft;
}

describe('StepControl suffix under font scale', () => {
  it('keeps the design gap at the default text size', () => {
    expect(suffixGapAt(1)).toBe(space.stepSuffixGap);
  });

  it('grows the gap with the text so the value and suffix stay apart', () => {
    expect(suffixGapAt(2)).toBe(space.stepSuffixGap * 2);
  });
});

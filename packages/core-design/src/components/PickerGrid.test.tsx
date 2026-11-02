import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { PickerGrid } from './PickerGrid.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const display = vi.hoisted(() => ({ fontScale: 1 }));
const items = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  return {
    ...actual,
    useWindowDimensions: () => ({ fontScale: display.fontScale }),
    Pressable: (props: Props) => {
      items.push(props);
      return createElement('div', null, props.children);
    },
  };
});

const { StyleSheet } = await import('react-native');

const OPTIONS = ['Beep', 'Woodblock', 'Click', 'Tom'].map((label) => ({
  value: label,
  label,
}));

function itemStylesAt(fontScale: number): ViewStyle[] {
  display.fontScale = fontScale;
  items.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <PickerGrid
        accessibilityLabel="normal beat sound"
        options={OPTIONS}
        selected="Tom"
        onSelect={vi.fn()}
      />
    </ThemeProvider>,
  );
  return items.map((item) =>
    StyleSheet.flatten(item.style as StyleProp<ViewStyle>),
  );
}

describe('PickerGrid under font scale', () => {
  it('keeps equal columns at the default text size', () => {
    for (const style of itemStylesAt(1)) expect(style.flex).toBe(1);
  });

  it('never shrinks an item below its label once the text grows', () => {
    for (const style of itemStylesAt(2)) {
      expect(style.flex).toBeUndefined();
      expect(style.flexShrink ?? 0).toBe(0);
    }
  });
});

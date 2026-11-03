import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { inset } from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { PresetButton, type PresetButtonKind } from './PresetButton.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const display = vi.hoisted(() => ({ fontScale: 1 }));
const faces = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    useWindowDimensions: () => ({ fontScale: display.fontScale }),
    Pressable: (props: Props) => h('div', null, props.children),
    View: (props: Props) => {
      faces.push(props);
      return h('div', null, props.children);
    },
  };
});

const { StyleSheet } = await import('react-native');

function faceAt(
  fontScale: number,
  kind: PresetButtonKind = 'preset',
): ViewStyle {
  display.fontScale = fontScale;
  faces.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <PresetButton kind={kind} label="−10" onPress={vi.fn()} />
    </ThemeProvider>,
  );
  return StyleSheet.flatten(faces[0]?.style as StyleProp<ViewStyle>);
}

describe('PresetButton under font scale', () => {
  it('keeps the design spacing at the default scale', () => {
    expect(faceAt(1).paddingHorizontal).toBeUndefined();
    expect(faceAt(1, 'action').paddingHorizontal).toBeUndefined();
  });

  it('keeps a grown label clear of the key edge', () => {
    expect(faceAt(2).paddingHorizontal).toBe(inset.presetLabelH);
    expect(faceAt(2, 'action').paddingHorizontal).toBe(inset.presetLabelH);
  });
});

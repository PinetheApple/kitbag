import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { opacity } from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { Chip } from './Chip.tsx';

type Props = Record<string, unknown> & { readonly children?: unknown };

const faces = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    Pressable: (props: Props) => h('div', null, props.children as never),
    View: (props: Props) => {
      faces.push(props);
      return h('div', null, props.children as never);
    },
  };
});

vi.mock('./Icon.tsx', () => ({ Icon: () => null }));

const { StyleSheet } = await import('react-native');

function faceOpacity(muted: boolean): ViewStyle['opacity'] {
  faces.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <Chip label="Count-in" muted={muted} onPress={vi.fn()} />
    </ThemeProvider>,
  );
  return StyleSheet.flatten(faces[0]?.style as StyleProp<ViewStyle>).opacity;
}

describe('a muted chip', () => {
  it('draws its face at the muted opacity', () => {
    expect(faceOpacity(true)).toBe(opacity.muted);
  });

  it('draws a plain chip at full strength', () => {
    expect(faceOpacity(false)).toBeUndefined();
  });
});

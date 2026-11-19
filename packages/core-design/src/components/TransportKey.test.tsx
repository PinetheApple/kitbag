import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

import { opacity } from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { TransportKey } from './TransportKey.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const pressables = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    Pressable: (props: Props) => {
      pressables.push(props);
      return h('div', null, props.children);
    },
  };
});

vi.mock('./IconGlyph.tsx', () => ({ InlineIcon: () => null }));

const { StyleSheet } = await import('react-native');

function rendered(muted: boolean, disabled: boolean) {
  pressables.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <TransportKey
        text="1.0×"
        accessibilityLabel="Speed"
        muted={muted}
        disabled={disabled}
        onPress={vi.fn()}
      />
    </ThemeProvider>,
  );
  const [key] = pressables;
  return {
    pressable: key?.disabled,
    announced: (key?.accessibilityState as { disabled: boolean }).disabled,
    opacity: StyleSheet.flatten(key?.style as StyleProp<ViewStyle>).opacity,
  };
}

it('looks and reads disabled when muted but still takes a press', () => {
  expect(rendered(true, false)).toEqual({
    pressable: false,
    announced: true,
    opacity: opacity.muted,
  });
});

it('blocks the press when disabled', () => {
  expect(rendered(false, true).pressable).toBe(true);
});

import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

import { opacity, textRoles } from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { TransportKey } from './TransportKey.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';

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

const faces = vi.hoisted(() => [] as Props[]);

vi.mock('./DesignFloorOneLineText.tsx', () => ({
  DesignFloorOneLineText: (props: Props) => {
    faces.push(props);
    return null;
  },
}));

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
    opacity: flatStyle(key?.style as StyleProp<ViewStyle>).opacity,
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

function dockKey(content: { text: string } | { icon: 'play' }) {
  pressables.length = 0;
  faces.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <TransportKey
        size="dock"
        {...content}
        accessibilityLabel="Key"
        onPress={vi.fn()}
      />
    </ThemeProvider>,
  );
  return {
    shrink: flatStyle(pressables[0]?.style as StyleProp<ViewStyle>).flexShrink,
    face: faces[0],
  };
}

it('hands a text face to the one-line fit with the dock role and lets the key shrink', () => {
  const { shrink, face } = dockKey({ text: '100%' });
  expect(shrink).toBe(1);
  expect(face?.text).toBe('100%');
  expect(face?.role).toBe(textRoles.dockKey);
});

it('draws a text face at the size its fit measures with', () => {
  const { face } = dockKey({ text: '100%' });
  const drawn = flatStyle(face?.style as StyleProp<TextStyle>);
  expect(drawn.fontSize).toBe((face?.role as { size: number }).size);
});

it('keeps an icon key at its own size', () => {
  const { shrink, face } = dockKey({ icon: 'play' });
  expect(shrink).toBeUndefined();
  expect(face).toBeUndefined();
});

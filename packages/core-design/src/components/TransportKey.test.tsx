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

const display = vi.hoisted(() => ({ fontScale: 1 }));
const texts = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    useWindowDimensions: () => ({ fontScale: display.fontScale, scale: 1 }),
    Pressable: (props: Props) => {
      pressables.push(props);
      return h('div', null, props.children);
    },
    Text: (props: Props) => {
      texts.push(props);
      return h('span', null, props.children);
    },
  };
});

vi.mock('./IconGlyph.tsx', () => ({ InlineIcon: () => null }));

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

const GROWN_FONT_SCALE = 2;

function dockKey(content: { text: string } | { icon: 'play' }, fontScale = 1) {
  display.fontScale = fontScale;
  pressables.length = 0;
  texts.length = 0;
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
  const [face] = texts;
  return {
    shrink: flatStyle(pressables[0]?.style as StyleProp<ViewStyle>).flexShrink,
    face,
    drawnSize:
      flatStyle(face?.style as StyleProp<TextStyle>).fontSize ?? Number.NaN,
  };
}

it('draws a text face whole at the label size at 100% text', () => {
  const { shrink, face, drawnSize } = dockKey({ text: '100%' });
  expect(shrink).toBeUndefined();
  expect(face?.numberOfLines).toBeUndefined();
  expect(face?.children).toBe('100%');
  expect(drawnSize).toBe(textRoles.transportKeyLabel.size);
});

it('keeps a text face at its design size and whole at 200% text', () => {
  const { shrink, face, drawnSize } = dockKey(
    { text: '100%' },
    GROWN_FONT_SCALE,
  );
  expect(shrink).toBeUndefined();
  expect(face?.numberOfLines).toBeUndefined();
  expect(drawnSize * GROWN_FONT_SCALE).toBe(textRoles.transportKeyLabel.size);
});

it('keeps an icon key at its own size', () => {
  const { shrink, face } = dockKey({ icon: 'play' });
  expect(shrink).toBeUndefined();
  expect(face).toBeUndefined();
});

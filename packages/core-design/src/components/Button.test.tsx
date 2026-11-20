import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { iconSizes, opacity } from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { Button, type ButtonProps } from './Button.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const drawn = vi.hoisted(() => ({
  faces: [] as Props[],
  icons: [] as Props[],
  labels: [] as Props[],
}));

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const View = actual.View as (props: Props) => ReactNode;
  const Text = actual.Text as (props: Props) => ReactNode;
  return {
    ...actual,
    View: (props: Props) => {
      drawn.faces.push(props);
      return createElement(View, props);
    },
    Text: (props: Props) => {
      drawn.labels.push(props);
      return createElement(Text, props);
    },
  };
});

vi.mock('./IconGlyph.tsx', () => ({
  InlineIcon: (props: Props) => {
    drawn.icons.push(props);
    return null;
  },
}));

const { StyleSheet } = await import('react-native');

function drawButton(props: Partial<ButtonProps>) {
  drawn.faces.length = 0;
  drawn.icons.length = 0;
  drawn.labels.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <Button label="Play next" variant="tonal" onPress={vi.fn()} {...props} />
    </ThemeProvider>,
  );
  return {
    face: StyleSheet.flatten(drawn.faces[0]?.style as StyleProp<ViewStyle>),
    icon: StyleSheet.flatten(drawn.icons[0]?.style as StyleProp<TextStyle>),
    label: StyleSheet.flatten(drawn.labels[0]?.style as StyleProp<TextStyle>),
  };
}

describe('Button opt-in looks', () => {
  it('draws a sheet-button icon at its own size', () => {
    const { icon } = drawButton({ icon: 'playNext', iconSize: 'sheetButton' });
    expect(icon.fontSize).toBe(iconSizes.sheetButton);
  });

  it('starts its content at the left edge when asked', () => {
    expect(drawButton({ align: 'start' }).face.justifyContent).toBe(
      'flex-start',
    );
    expect(drawButton({}).face.justifyContent).toBe('center');
  });

  it('fades a disabled tonal button instead of clearing its fill', () => {
    const enabled = drawButton({});
    const faded = drawButton({ disabled: true, disabledLook: 'faded' });
    expect(faded.face.backgroundColor).toBe(enabled.face.backgroundColor);
    expect(faded.face.borderColor).toBe(enabled.face.borderColor);
    expect(faded.face.opacity).toBe(opacity.muted);
    expect(faded.label.color).toBe(enabled.label.color);
  });

  it('keeps the existing disabled look by default', () => {
    const plain = drawButton({ disabled: true });
    expect(plain.face.backgroundColor).toBe('transparent');
    expect(plain.face.opacity).toBeUndefined();
  });
});

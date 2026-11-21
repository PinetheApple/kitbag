import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import {
  BUTTONS_STACKED_ID,
  ButtonRow,
  type ButtonRowProps,
} from './ButtonRow.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const scale = vi.hoisted(() => ({ scaled: false }));
const views = vi.hoisted(() => [] as Props[]);

vi.mock('../useTextScaled.ts', () => ({ useTextScaled: () => scale.scaled }));

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    View: (props: Props) => {
      views.push(props);
      return h('div', null, props.children);
    },
  };
});

function laidOut(scaled: boolean, props: Partial<ButtonRowProps> = {}) {
  scale.scaled = scaled;
  views.length = 0;
  const html = renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <ButtonRow {...props}>
        <i>first</i>
        <b>last</b>
      </ButtonRow>
    </ThemeProvider>,
  );
  const frame = views[0];
  return {
    order: [...html.matchAll(/<(i|b)>(\w+)/g)].map((m) => m[2]),
    direction: flatStyle(frame?.style as StyleProp<ViewStyle>).flexDirection,
    stackedId: frame?.testID,
  };
}

describe('ButtonRow', () => {
  it('sets the buttons side by side in the given order at the design size', () => {
    expect(laidOut(false)).toEqual({
      order: ['first', 'last'],
      direction: 'row',
      stackedId: undefined,
    });
  });

  it('stacks a trailing primary first when text is scaled', () => {
    expect(laidOut(true)).toEqual({
      order: ['last', 'first'],
      direction: undefined,
      stackedId: BUTTONS_STACKED_ID,
    });
  });

  it('keeps a leading primary first when it stacks', () => {
    expect(laidOut(true, { primaryAt: 'start' }).order).toEqual([
      'first',
      'last',
    ]);
  });

  it('follows the caller when it decides the stacking', () => {
    expect(laidOut(false, { stacked: true }).stackedId).toBe(
      BUTTONS_STACKED_ID,
    );
    expect(laidOut(true, { stacked: false }).stackedId).toBeUndefined();
  });
});

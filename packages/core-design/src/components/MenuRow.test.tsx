import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { MenuRow, type MenuRowProps } from './MenuRow.tsx';

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

vi.mock('./IconGlyph.tsx', () => ({ IconGlyph: () => null }));

function labelOf(props: Partial<MenuRowProps>): unknown {
  pressables.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <MenuRow icon="countIn" label="Count-in" onPress={vi.fn()} {...props} />
    </ThemeProvider>,
  );
  return pressables[0]?.accessibilityLabel;
}

beforeEach(() => {
  pressables.length = 0;
});

describe('MenuRow', () => {
  it('reads its value and its second line together', () => {
    expect(
      labelOf({ value: 'Off', detail: 'Arrives with count-in for songs' }),
    ).toBe('Count-in, Off, Arrives with count-in for songs');
  });

  it.each([
    [{ value: 'Off' }, 'Count-in, Off'],
    [{ detail: 'Find the beat again' }, 'Count-in, Find the beat again'],
    [{}, 'Count-in'],
  ])('reads %o as %s', (props, label) => {
    expect(labelOf(props)).toBe(label);
  });

  it('speaks its spoken value in place of the shown one', () => {
    expect(
      labelOf({ value: '×1 · 104 BPM', spokenValue: 'as detected, 104 BPM' }),
    ).toBe('Count-in, as detected, 104 BPM');
  });
});

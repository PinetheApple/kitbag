import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const display = vi.hoisted(() => ({ scaled: false }));
const texts = vi.hoisted(() => [] as string[]);

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  return {
    View: (props: Props) => h('div', null, props.children),
    Text: (props: Props) => {
      if (typeof props.children === 'string') texts.push(props.children);
      return h('span', null, props.children);
    },
  };
});

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () => ({}),
  textStyle: () => ({}),
  useTextScaled: () => display.scaled,
}));

const { PolyStrip } = await import('./PolyStrip.tsx');

function captionAt(scaled: boolean): readonly string[] {
  display.scaled = scaled;
  texts.length = 0;
  renderToStaticMarkup(
    createElement(PolyStrip, { polyBeats: 3, against: 4, beatsPerBar: 4 }),
  );
  display.scaled = false;
  return [...texts];
}

describe('the poly strip caption', () => {
  it('reads as one wrapped sentence at scaled text', () => {
    expect(captionAt(true)).toEqual([
      'one cycle: 3 poly over 4 main, across 4 of 4 beats',
    ]);
  });

  it('keeps the design split into cycle and span at the default size', () => {
    expect(captionAt(false)).toHaveLength(2);
  });
});

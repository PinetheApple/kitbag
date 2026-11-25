import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const pressables = vi.hoisted(() => [] as Props[]);
const texts = vi.hoisted(() => [] as unknown[]);

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  return {
    View: (props: Props) => h('div', null, props.children),
    Pressable: (props: Props) => {
      pressables.push(props);
      return h('div', null, props.children);
    },
    Text: (props: Props) => {
      texts.push(props.children);
      return h('span', null, props.children);
    },
  };
});

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () => new Proxy({}, { get: () => ({}) }),
  InlineIcon: () => null,
}));

const { PracticePill } = await import('./PracticePill.tsx');

const TEN_SECONDS = 10_000;
const ELEVEN_SECONDS = 11_000;

function drawAt(elapsedMs: number) {
  pressables.length = 0;
  texts.length = 0;
  renderToStaticMarkup(
    createElement(PracticePill, { elapsedMs, onEnd: vi.fn() }),
  );
  return { label: pressables[0]?.accessibilityLabel, texts: [...texts] };
}

describe('PracticePill', () => {
  it('ticks the visible clock but keeps its spoken label still', () => {
    const before = drawAt(TEN_SECONDS);
    const after = drawAt(ELEVEN_SECONDS);
    expect(after.texts).not.toEqual(before.texts);
    expect(before.label).toEqual(expect.any(String));
    expect(after.label).toBe(before.label);
  });
});

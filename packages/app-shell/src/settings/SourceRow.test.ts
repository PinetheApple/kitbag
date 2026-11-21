import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const GROWN_FONT_SCALE = 2;
const rows = vi.hoisted(() => [] as Props[]);
const values = vi.hoisted(() => [] as Props[]);
const display = vi.hoisted(() => ({ fontScale: 1 }));

vi.mock('react-native', () => ({
  Linking: { openURL: () => Promise.resolve() },
}));

vi.mock('@kitbag/core-design', async () => {
  const { createElement: h } = await import('react');
  const { isTextScaled } =
    await import('../../../core-design/src/textScale.ts');
  return {
    EditRow: (props: Props) => {
      rows.push(props);
      return h('div', null, props.children);
    },
    EditValue: (props: Props) => {
      values.push(props);
      return h('span', null, props.children);
    },
    useTextScaled: () => isTextScaled(display.fontScale),
  };
});

const { SourceRow } = await import('./SourceRow.tsx');

function renderAt(fontScale: number) {
  display.fontScale = fontScale;
  rows.length = 0;
  values.length = 0;
  renderToStaticMarkup(createElement(SourceRow));
  display.fontScale = 1;
  return { row: rows[0], value: values[0] };
}

describe('source row', () => {
  it('keeps the address beside the label at the default text size, cut in the middle', () => {
    const { row, value } = renderAt(1);
    expect(row?.singleLine).toBe(true);
    expect(value).toMatchObject({ oneLine: true, ellipsizeMode: 'middle' });
  });

  it('gives the address its own lines once the text grows', () => {
    const { row, value } = renderAt(GROWN_FONT_SCALE);
    expect(row?.singleLine).toBe(false);
    expect(value?.oneLine).toBe(false);
  });
});

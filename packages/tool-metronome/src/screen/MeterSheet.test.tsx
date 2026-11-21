import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return { View: host, Text: host, Pressable: host };
});

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    textStyle: () => ({}),
    WheelPicker: () => null,
    SheetHint: () => null,
    Button: (props: Props) => h('button', null, props.label as string),
    Sheet: (props: Props) =>
      h(
        'section',
        null,
        h('main', null, props.children),
        h('footer', null, props.footer as ReactNode),
      ),
  };
});

vi.mock('@kitbag/core-state', () => ({
  useMetronome: (select: (state: unknown) => unknown) =>
    select({ beatsPerBar: 4, denominator: 4, setBeats: () => undefined }),
}));

vi.mock('./sheetStyles.ts', () => ({ useSheetStyles: () => ({}) }));

const { MeterSheet } = await import('./MeterSheet.tsx');

function region(markup: string, tag: string): string {
  return markup.split(`<${tag}>`)[1]?.split(`</${tag}>`)[0] ?? '';
}

it('keeps Cancel and Set outside the scroll so a short window still shows them', () => {
  const markup = renderToStaticMarkup(
    createElement(MeterSheet, {
      visible: true,
      bottomInset: 0,
      onDismiss: vi.fn(),
    }),
  );
  const footer = region(markup, 'footer');
  expect(footer).toContain('Cancel');
  expect(footer).toContain('Set 4/4');
  expect(region(markup, 'main')).not.toContain('<button>');
});

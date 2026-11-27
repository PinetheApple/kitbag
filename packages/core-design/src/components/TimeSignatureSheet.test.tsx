import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const COMMON_TIME = 4;
const MAX_BEATS = 16;
const DENOMINATORS = [2, 4, 8, 16];

vi.mock('./WheelPicker.tsx', () => ({ WheelPicker: () => null }));
vi.mock('./SheetHint.tsx', () => ({ SheetHint: () => null }));
vi.mock('./Button.tsx', async () => {
  const { createElement: h } = await import('react');
  return {
    Button: (props: Props) => h('button', null, props.label as string),
  };
});
vi.mock('./Sheet.tsx', async () => {
  const { createElement: h } = await import('react');
  return {
    Sheet: (props: Props) =>
      h(
        'section',
        null,
        h('main', null, props.children),
        h('footer', null, props.footer as ReactNode),
      ),
  };
});

const { TimeSignatureSheet } = await import('./TimeSignatureSheet.tsx');

function region(markup: string, tag: string): string {
  return markup.split(`<${tag}>`)[1]?.split(`</${tag}>`)[0] ?? '';
}

it('keeps Cancel and Set outside the scroll so a short window still shows them', () => {
  const markup = renderToStaticMarkup(
    createElement(TimeSignatureSheet, {
      visible: true,
      bottomInset: 0,
      beatsPerBar: COMMON_TIME,
      denominator: COMMON_TIME,
      maxBeats: MAX_BEATS,
      denominators: DENOMINATORS,
      onSet: vi.fn(),
      onDismiss: vi.fn(),
    }),
  );
  const footer = region(markup, 'footer');
  expect(footer).toContain('Cancel');
  expect(footer).toContain('Set 4/4');
  expect(region(markup, 'main')).not.toContain('<button>');
});

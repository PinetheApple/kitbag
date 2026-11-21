// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, type ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const FITS: Readonly<Record<string, number>> = {
  Metronome: 10,
  Tuner: 14,
  Songs: 14,
  'Stem songs': 9,
};

vi.mock('react-native', async (importOriginal) => {
  const { createElement: h } = await import('react');
  return {
    ...(await importOriginal<typeof import('react-native')>()),
    View: (props: Props) => h('View', props),
    Text: (props: Props) => h('Text', props),
    Pressable: (props: Props) => h('Pressable', props),
  };
});

vi.mock('../useOneLineFit.tsx', () => ({
  useOneLineFit: ({ text }: { text: string }) => ({
    style: { fontSize: FITS[text] },
    onAvailableLayout: () => undefined,
    measurer: null,
  }),
}));

vi.mock('./IconGlyph.tsx', () => ({ InlineIcon: () => null }));

const { ToolGrid } = await import('./ToolTile.tsx');

const tiles = Object.keys(FITS).map((title) => ({
  id: title,
  icon: 'metronome' as const,
  title,
  subtext: '',
  status: 'ready' as const,
  size: '1x1' as const,
}));

it('shows every tile title at the size of the tightest fit', () => {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(
      <ThemeProvider mode="dark">
        <ToolGrid tiles={tiles} />
      </ThemeProvider>,
    );
  });
  const sizes = renderer?.root
    .findAll(
      (node) => String(node.type) === 'Text' && node.props.numberOfLines === 1,
    )
    .map(
      (node) =>
        flatStyle(node.props.style as StyleProp<TextStyle>).fontSize ?? null,
    );
  expect(sizes).toEqual(tiles.map(() => Math.min(...Object.values(FITS))));
});

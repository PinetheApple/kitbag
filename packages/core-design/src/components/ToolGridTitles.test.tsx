// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, type ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const FITS: Readonly<Record<string, number>> = {
  Metronome: 10,
  Tuner: 14,
  Songs: 14,
  'Stem songs': 9,
};
const TIGHTEST = Math.min(...Object.values(FITS));
const HIDDEN = 0;

const measured = vi.hoisted(() => new Set<string>());

vi.mock('react-native', async (importOriginal) => {
  const { createElement: h } = await import('react');
  return {
    ...(await importOriginal<typeof import('react-native')>()),
    View: (props: Props) => h('View', props),
    Text: (props: Props) => h('Text', props),
    Pressable: (props: Props) => h('Pressable', props),
  };
});

vi.mock('../useOneLineFit.tsx', async () => {
  const { UNMEASURED_STYLE } = await import('../oneLineFit.ts');
  return {
    useOneLineFit: ({ text }: { text: string }) => ({
      style: measured.has(text) ? { fontSize: FITS[text] } : UNMEASURED_STYLE,
      onAvailableLayout: () => undefined,
      measurer: null,
    }),
  };
});

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

const grid = () => (
  <ThemeProvider mode="dark">
    <ToolGrid tiles={tiles} />
  </ThemeProvider>
);

let renderer: ReactTestRenderer | undefined;

function shownTitles(): TextStyle[] {
  return (
    renderer?.root
      .findAll(
        (node) =>
          String(node.type) === 'Text' && node.props.numberOfLines === 1,
      )
      .map((node) => flatStyle(node.props.style as StyleProp<TextStyle>)) ?? []
  );
}

function measure(...titles: readonly string[]) {
  for (const title of titles) measured.add(title);
  act(() => {
    renderer?.update(grid());
  });
}

beforeEach(() => {
  measured.clear();
  act(() => {
    renderer = create(grid());
  });
});

it('shows every tile title at the size of the tightest fit', () => {
  measure(...Object.keys(FITS));
  expect(shownTitles().map((style) => style.fontSize)).toEqual(
    tiles.map(() => TIGHTEST),
  );
});

it('keeps every title hidden until the last tile has fitted, so none shrinks in view', () => {
  for (const title of Object.keys(FITS).slice(0, -1)) {
    measure(title);
    expect(shownTitles().map((style) => style.opacity)).toEqual(
      tiles.map(() => HIDDEN),
    );
  }
  measure(...Object.keys(FITS));
  expect(shownTitles().map((style) => style.opacity)).toEqual(
    tiles.map(() => undefined),
  );
});

import type { LibrarySongRow } from '@kitbag/core-state';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const TITLE = 'A title';
const FACTS = '0:30';
const BADGE_MARK = 'badge-mark';

const display = vi.hoisted(() => ({ fontScale: 1 }));

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const box = (props: Props) => {
    const flat = Object.assign({}, ...[props.style].flat()) as Record<
      string,
      unknown
    >;
    return h(
      flat.flex === 1 && flat.minWidth === 0 ? 'section' : 'div',
      null,
      props.children,
    );
  };
  return {
    View: box,
    Pressable: box,
    Text: (props: Props) => h('b', null, props.children),
    useWindowDimensions: () => ({ fontScale: display.fontScale }),
  };
});

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    Badge: () => h('i', null, 'badge-mark'),
    EllipsizedText: (props: Props) =>
      h('span', { 'data-lines': props.numberOfLines }, props.children),
    libraryList: new Proxy({}, { get: () => 0 }),
    Icon: () => null,
    createThemedStyles: () => () =>
      new Proxy(
        {},
        {
          get: (_styles, key) =>
            key === 'text' ? { flex: 1, minWidth: 0 } : {},
        },
      ),
    useTheme: () => ({}),
  };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSongLibrary: (select: (state: { codes: unknown }) => unknown) =>
    select({ codes: {} }),
  songBadge: () => 'grid',
  analysisFailure: () => null,
}));

const { LibraryRowView } = await import('./LibraryRowView.tsx');

const ROW = {
  kind: 'song',
  id: 1,
  title: TITLE,
  artist: '',
  durationSec: 30,
  bpm: 120,
} as unknown as LibrarySongRow;

function render(fontScale: number) {
  display.fontScale = fontScale;
  const markup = renderToStaticMarkup(
    createElement(LibraryRowView, {
      row: ROW,
      selected: false,
      onActions: vi.fn(),
      onOpenStemSet: vi.fn(),
    }),
  );
  const column = /<section>.*<\/section>/s.exec(markup)?.[0] ?? '';
  const linesOf = (text: string) =>
    Number(new RegExp(`data-lines="(\\d+)">${text}`).exec(markup)?.[1]);
  return {
    titleLines: linesOf(TITLE),
    factsLines: linesOf(FACTS),
    badgeShown: markup.includes(BADGE_MARK),
    badgeInColumn: column.includes(BADGE_MARK),
  };
}

describe('LibraryRowView', () => {
  it('keeps one title line and the badges beside the text at 1.0', () => {
    expect(render(1)).toEqual({
      titleLines: 1,
      factsLines: 1,
      badgeShown: true,
      badgeInColumn: false,
    });
  });

  it('bounds the title and puts the badges under the text at 2.0', () => {
    expect(render(2)).toEqual({
      titleLines: 3,
      factsLines: 2,
      badgeShown: true,
      badgeInColumn: true,
    });
  });
});

import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return {
    View: host,
    StyleSheet: { create: <T,>(styles: T) => styles },
  };
});

const drawn = vi.hoisted(() => ({
  rows: [] as Props[],
  buttons: [] as Props[],
  icons: [] as Props[],
}));
const store = vi.hoisted(() => ({ acceptOffer: vi.fn() }));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const capture = (into: Props[]) => (props: Props) => {
    into.push(props);
    return null;
  };
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    useTheme: () => ({ accentInk: 'accentText' }),
    Card: (props: Props) => h('section', null, props.children),
    RowText: capture(drawn.rows),
    RowIcon: capture(drawn.icons),
    Button: capture(drawn.buttons),
  };
});

vi.mock('./playAlongHooks.ts', () => ({
  usePlayAlong: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

const { LibraryOfferCard } = await import('./LibraryOfferCard.tsx');

beforeEach(() => {
  vi.clearAllMocks();
  store.acceptOffer.mockResolvedValue({ locked: true });
  drawn.rows.length = 0;
  drawn.buttons.length = 0;
  drawn.icons.length = 0;
  renderToStaticMarkup(createElement(LibraryOfferCard));
});

it('says the library holds a beat grid for the song', () => {
  expect(drawn.rows[0]).toMatchObject({
    title: 'In your library',
    subtitle: 'Beat grid found',
  });
  expect(drawn.icons[0]).toMatchObject({
    icon: 'beatGrid',
    color: 'accentText',
  });
});

it('locks on the stored grid only when Lock is tapped', () => {
  const [lock] = drawn.buttons;
  expect(lock).toMatchObject({
    label: 'Lock',
    variant: 'primary',
    size: 'prompt',
  });
  expect(store.acceptOffer).not.toHaveBeenCalled();
  (lock?.onPress as () => void)();
  expect(store.acceptOffer).toHaveBeenCalledOnce();
});

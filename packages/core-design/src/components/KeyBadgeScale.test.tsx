import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const BADGE = '1';
const GROWN_FONT_SCALE = 2;
const noop = () => undefined;

const icons = vi.hoisted(() => [] as Props[]);
const texts = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (importOriginal) => {
  const { createElement: h } = await import('react');
  return {
    ...(await importOriginal<typeof import('react-native')>()),
    useWindowDimensions: () => ({ fontScale: GROWN_FONT_SCALE, scale: 1 }),
    Text: (props: Props) => {
      texts.push(props);
      return h('span', null, props.children);
    },
  };
});

vi.mock('./Icon.tsx', () => ({
  Icon: (props: Props) => {
    icons.push(props);
    return null;
  },
}));

const { BarIconButton } = await import('./AppBar.tsx');

it('grows a bar key badge no further than the icon it sits on', () => {
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <BarIconButton icon="queue" label="Queue" badge={BADGE} onPress={noop} />
    </ThemeProvider>,
  );
  const badge = texts.find((text) => text.children === BADGE);
  expect(badge?.maxFontSizeMultiplier).toBe(icons[0]?.scale);
});

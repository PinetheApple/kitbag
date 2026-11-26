import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return {
    View: host,
    Text: host,
    Pressable: host,
    StyleSheet: { create: <T,>(styles: T) => styles },
  };
});

const keys = vi.hoisted(() => [] as Props[]);
const store = vi.hoisted(() => ({
  previous: vi.fn(),
  playPause: vi.fn(),
  next: vi.fn(),
}));

vi.mock('react-native-reanimated', () => ({
  useSharedValue: (value: number) => ({ value }),
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const capture = (props: Props) => {
    keys.push(props);
    return null;
  };
  return {
    ...(await original<Record<string, unknown>>()),
    PlayerDock: (props: Props) => h('div', null, props.children),
    TransportKey: capture,
    PlayPauseButton: capture,
  };
});

vi.mock('./playAlongHooks.ts', () => ({
  usePlayAlong: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

const { PlayAlongDock } = await import('./PlayAlongDock.tsx');

function render(disabled = false) {
  keys.length = 0;
  renderToStaticMarkup(
    createElement(PlayAlongDock, { playing: true, disabled, bottomInset: 0 }),
  );
  return keys;
}

beforeEach(() => {
  vi.clearAllMocks();
});

it('drives the other app with Previous, Play/Pause and Next, and nothing else', () => {
  const [previous, play, next, ...rest] = render();
  expect(rest).toEqual([]);
  expect(previous?.icon).toBe('previous');
  expect(previous?.onPress).toBe(store.previous);
  expect(play?.onPress).toBe(store.playPause);
  expect(next?.icon).toBe('next');
  expect(next?.onPress).toBe(store.next);
});

it('disables the song keys while the followed app is gone', () => {
  const [previous, , next] = render(true);
  expect(previous?.disabled).toBe(true);
  expect(next?.disabled).toBe(true);
});

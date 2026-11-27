// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { vi } from 'vitest';

import {
  SongPlayerScreen,
  type SongPlayerScreenProps,
} from './SongPlayerScreen.tsx';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export const onBack = vi.fn();
export const onOpenStemSet = vi.fn();
export const onOpenSong = vi.fn();
export const onOpenQueue = vi.fn();
export const onOpenSetlist = vi.fn();

const playhead = () =>
  ({
    songSec: { value: 0 },
    progress: { value: 0 },
    playing: { value: 0 },
  }) as never;

export function screen(
  focused: boolean,
  routes: Partial<SongPlayerScreenProps> = {},
) {
  return createElement(SongPlayerScreen, {
    songId: 1,
    focused,
    insets: { top: 0, bottom: 0 },
    onBack,
    onOpenStemSet,
    onOpenSong,
    onOpenQueue,
    onOpenSetlist,
    usePlayhead: playhead,
    ...routes,
  });
}

export function mount(
  focused = true,
  routes: Partial<SongPlayerScreenProps> = {},
): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(screen(focused, routes));
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

interface BarAction {
  readonly label: string;
  readonly onPress: () => void;
}

export function barActions(tree: ReactTestRenderer): readonly BarAction[] {
  return tree.root.findByType('AppBar' as never).props
    .actions as readonly BarAction[];
}

export function pressBarAction(tree: ReactTestRenderer, label: string) {
  act(() => {
    barActions(tree)
      .find((action) => action.label === label)
      ?.onPress();
  });
}

export function styleAround(tree: ReactTestRenderer, type: string) {
  let host: ReactTestInstance | null = tree.root.findByType(
    type as never,
  ).parent;
  while (host !== null && typeof host.type !== 'string') host = host.parent;
  const style: unknown = host?.props.style;
  return Object.assign({}, ...[style].flat(Infinity)) as Record<
    string,
    unknown
  >;
}

// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { vi } from 'vitest';

import { SongPlayerScreen } from './SongPlayerScreen.tsx';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

export const onBack = vi.fn();

const playhead = () => ({}) as never;

export function screen(focused: boolean) {
  return createElement(SongPlayerScreen, {
    songId: 1,
    focused,
    insets: { top: 0, bottom: 0 },
    onBack,
    usePlayhead: playhead,
  });
}

export function mount(focused = true): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(screen(focused));
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
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

// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SNACKBAR_DURATION_MS } from '../snackbarRoles.ts';

vi.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
}));
vi.mock('./Snackbar.tsx', () => ({ Snackbar: 'Snackbar' }));

const { TimedSnackbar, useSnackbarShown } = await import('./TimedSnackbar.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = 1_000_000;
const EXPIRED = 2 * SNACKBAR_DURATION_MS;

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(NOW);
});

function draw(at: number, onTimeout = vi.fn()) {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      createElement(TimedSnackbar, {
        at,
        message: 'Deleted “Gig”',
        actionLabel: 'Undo',
        bottom: 0,
        onAction: vi.fn(),
        onTimeout,
      }),
    );
  });
  if (tree === undefined) throw new Error('not mounted');
  return { tree, onTimeout };
}

function Shown({
  at,
  onShown,
}: {
  readonly at: number | undefined;
  readonly onShown: (shown: boolean) => void;
}) {
  onShown(useSnackbarShown(at));
  return null;
}

function shown(at: number | undefined): boolean {
  const onShown = vi.fn();
  act(() => {
    create(createElement(Shown, { at, onShown }));
  });
  return onShown.mock.lastCall?.[0] as boolean;
}

describe('a timed Undo snackbar', () => {
  it('shows for the full duration right after the event', () => {
    const { tree } = draw(NOW);
    const bar = tree.root.findByType('Snackbar' as never);
    expect(bar.props.durationMs).toBe(SNACKBAR_DURATION_MS);
  });

  it('times out at once, unseen, when its window passed while away', () => {
    const { tree, onTimeout } = draw(NOW - EXPIRED);
    expect(tree.root.findAllByType('Snackbar' as never)).toEqual([]);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('counts as shown only while time is left', () => {
    expect(shown(NOW)).toBe(true);
    expect(shown(NOW - EXPIRED)).toBe(false);
    expect(shown(undefined)).toBe(false);
  });
});

import type { ReactElement, ReactNode } from 'react';
import { expect, it, vi } from 'vitest';

interface Memo {
  value: unknown;
  deps: readonly unknown[];
}

const { memo, callbacks, open } = vi.hoisted(() => {
  const initial: Memo = { value: undefined, deps: [] };
  return {
    memo: initial,
    callbacks: new Map<string, unknown>(),
    open: { slots: [] as unknown[] },
  };
});

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: () => [open.slots, vi.fn()],
  useCallback: <T>(fn: T) => {
    const key = String(fn);
    if (!callbacks.has(key)) callbacks.set(key, fn);
    return callbacks.get(key) as T;
  },
  useMemo: <T>(factory: () => T, deps: readonly unknown[]) => {
    const stale = deps.some((dep, i) => !Object.is(dep, memo.deps[i]));
    if (memo.deps.length === 0 || stale) {
      memo.value = factory();
      memo.deps = deps;
    }
    return memo.value as T;
  },
  useContext: () => memo.value,
}));
vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: <T>(styles: T) => styles, absoluteFill: {} },
}));

const { SheetHost, useSheetPortal } = await import('./SheetHost.tsx');

const STATUS_BAR = 24;
const CUTOUT_STATUS_BAR = 40;

function usePortalInset(topInset: number) {
  SheetHost({ topInset, children: null });
  return useSheetPortal().topInset;
}

it('hands sheets the top inset and follows it when it changes', () => {
  expect(usePortalInset(STATUS_BAR)).toBe(STATUS_BAR);
  expect(usePortalInset(CUTOUT_STATUS_BAR)).toBe(CUTOUT_STATUS_BAR);
});

type HostProps = Readonly<{
  importantForAccessibility?: string;
  accessibilityElementsHidden?: boolean;
  children?: ReactNode;
}>;

const APP = 'app';
const HIDDEN = {
  importantForAccessibility: 'no-hide-descendants',
  accessibilityElementsHidden: true,
};
const SHOWN = {
  importantForAccessibility: 'auto',
  accessibilityElementsHidden: false,
};

function layers(...ids: string[]) {
  open.slots = ids.map((id) => ({ id, node: id }));
  const host = SheetHost({ topInset: STATUS_BAR, children: APP });
  const [app, ...slots] = [(host.props as HostProps).children].flat(
    Infinity,
  ) as ReactElement<HostProps>[];
  if (app === undefined) throw new Error('SheetHost drew no app layer');
  return { app, slots };
}

function hiding(layer: ReactElement<HostProps>) {
  const { importantForAccessibility, accessibilityElementsHidden } =
    layer.props;
  return { importantForAccessibility, accessibilityElementsHidden };
}

it('leaves the app reachable by screen readers while no sheet is open', () => {
  const { app } = layers();
  expect(app.props.children).toBe(APP);
  expect(hiding(app)).toEqual(SHOWN);
});

it('hides the app and every sheet but the top one from screen readers', () => {
  const { app, slots } = layers('lower', 'top');
  expect(app.props.children).toBe(APP);
  expect(hiding(app)).toEqual(HIDDEN);
  expect(slots.map(hiding)).toEqual([HIDDEN, SHOWN]);
});

it('gives the app back to screen readers once the sheets close', () => {
  layers('only');
  expect(hiding(layers().app)).toEqual(SHOWN);
});

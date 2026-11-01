import { expect, it, vi } from 'vitest';

interface Memo {
  value: unknown;
  deps: readonly unknown[];
}

const { memo, callbacks } = vi.hoisted(() => {
  const initial: Memo = { value: undefined, deps: [] };
  return { memo: initial, callbacks: new Map<string, unknown>() };
});

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useState: <T>(initial: T) => [initial, vi.fn()],
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
  StyleSheet: { absoluteFill: {} },
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

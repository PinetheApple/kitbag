import { expect, it, vi } from 'vitest';

const focusReaderNode = vi.hoisted(() => vi.fn());
const setReaderFocuser = vi.hoisted(() => vi.fn());
vi.mock('@kitbag/core-native', () => ({ focusReaderNode }));
vi.mock('@kitbag/core-design', () => ({ setReaderFocuser }));

const { installReaderFocus } = await import('./readerFocusRuntime.ts');

it('routes screen reader focus through the native focus call', () => {
  installReaderFocus();
  expect(setReaderFocuser).toHaveBeenCalledExactlyOnceWith(focusReaderNode);
});

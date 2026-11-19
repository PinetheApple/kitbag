import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';

const focusReaderNode = vi.hoisted(() => vi.fn());
const setReaderFocuser = vi.hoisted(() => vi.fn());
vi.mock('@kitbag/core-native', () => ({ focusReaderNode }));
vi.mock('@kitbag/core-design', () => ({ setReaderFocuser }));

const LAYOUT = join(import.meta.dirname, '..', 'app', '_layout.tsx');

it('routes screen reader focus through the native call once imported', async () => {
  await import('./readerFocusRuntime.ts');
  expect(setReaderFocuser).toHaveBeenCalledExactlyOnceWith(focusReaderNode);
});

it('is imported by the root layout', () => {
  expect(readFileSync(LAYOUT, 'utf8')).toContain(
    "import '@/runtime/readerFocusRuntime';",
  );
});

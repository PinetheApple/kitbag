import { describe, expect, it } from 'vitest';

import { redirectSystemPath } from './systemPath.ts';

const CONTENT = 'content://com.android.providers.downloads/document/42';
const FILE = 'file:///sdcard/Download/Everlong.mp3';

describe('routing a system file URI', () => {
  it.each([CONTENT, FILE])('opens Home when %s starts the app', (path) => {
    expect(redirectSystemPath({ path, initial: true })).toBe('/');
  });

  it.each([CONTENT, FILE])(
    'stays on the current screen when %s arrives warm',
    (path) => {
      expect(redirectSystemPath({ path, initial: false })).toBe('');
    },
  );

  it.each([
    'kitbag://stemdeck?server=https%3A%2F%2Fexample.test',
    'exp+kitbag://stemdeck',
    '/stems',
  ])('passes %s through unchanged', (path) => {
    expect(redirectSystemPath({ path, initial: true })).toBe(path);
    expect(redirectSystemPath({ path, initial: false })).toBe(path);
  });
});

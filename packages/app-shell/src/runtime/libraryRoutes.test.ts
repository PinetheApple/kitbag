import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock('expo-router', () => ({ useRouter: () => router }));

const { useLibraryRoutes } = await import('./libraryRoutes.ts');

const ID = 4;

function routes() {
  let captured: ReturnType<typeof useLibraryRoutes> | undefined;
  const Probe = () => {
    captured = useLibraryRoutes();
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  if (captured === undefined) throw new Error('not rendered');
  return captured;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('library route URLs', () => {
  it.each([
    ['openPreset', 'push', '/presets/4'],
    ['replacePreset', 'replace', '/presets/4'],
    ['openSetlist', 'push', '/setlists/4'],
    ['openSong', 'navigate', '/library/4'],
    ['replaceSong', 'replace', '/library/4'],
    ['openStemSet', 'navigate', '/stems/4'],
    ['replaceStemSet', 'replace', '/stems/4'],
  ] as const)('%s calls %s with %s', (name, method, url) => {
    routes()[name](ID);
    expect(router[method]).toHaveBeenCalledExactlyOnceWith(url);
  });
});

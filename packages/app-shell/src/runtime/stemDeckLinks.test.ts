import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const APP_SHELL = join(import.meta.dirname, '..', '..');
const NOTIFICATIONS = join(
  APP_SHELL,
  '..',
  'core-native/android/src/main/java/com/kitbag/corenative/stemdeck/ImportNotifications.kt',
);
const APP_JSON = join(APP_SHELL, 'app.json');
const ROUTES = join(APP_SHELL, 'src', 'app');
const LINK = /const val \w+_LINK = "([a-z]+):\/\/([^"]+)"/g;

function links(): [string, string][] {
  const source = readFileSync(NOTIFICATIONS, 'utf8');
  return [...source.matchAll(LINK)].map(([, scheme = '', path = '']) => [
    scheme,
    path,
  ]);
}

function routeFileExists(path: string): boolean {
  return [`${path}.tsx`, join(path, 'index.tsx')].some((file) =>
    existsSync(join(ROUTES, file)),
  );
}

describe('the import notification links', () => {
  it('finds the links the notification opens', () => {
    expect(links()).toHaveLength(2);
  });

  it.each(links())('opens %s://%s, a route this app has', (scheme, path) => {
    const { expo } = JSON.parse(readFileSync(APP_JSON, 'utf8')) as {
      readonly expo: { readonly scheme: string };
    };
    expect(scheme).toBe(expo.scheme);
    expect(routeFileExists(path)).toBe(true);
  });
});

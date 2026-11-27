import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface RouterOptions {
  readonly sitemap?: boolean;
}

type PluginEntry = string | readonly [string, RouterOptions];

const { plugins } = (
  JSON.parse(
    readFileSync(join(import.meta.dirname, '..', 'app.json'), 'utf8'),
  ) as { expo: { plugins: readonly PluginEntry[] } }
).expo;

function routerOptions(): RouterOptions | undefined {
  const entry = plugins.find(
    (plugin) => plugin === 'expo-router' || plugin[0] === 'expo-router',
  );
  return typeof entry === 'string' ? {} : entry?.[1];
}

describe('expo-router sitemap', () => {
  it('is turned off, so no build serves the route list', () => {
    expect(routerOptions()?.sitemap).toBe(false);
  });
});

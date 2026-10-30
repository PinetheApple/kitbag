import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { palette } from '@kitbag/core-design';
import { describe, expect, it } from 'vitest';

const APP = join(import.meta.dirname, '..');
const RES = join(APP, 'android', 'app', 'src', 'main', 'res');

interface Splash {
  readonly backgroundColor?: string;
  readonly dark?: { readonly backgroundColor?: string };
}

const expo = (
  JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8')) as {
    expo: { splash: Splash; android: { splash: Splash } };
  }
).expo;

function splashColour(valuesDir: string): string | undefined {
  const xml = readFileSync(join(RES, valuesDir, 'colors.xml'), 'utf8');
  return /<color name="splashscreen_background">([^<]+)<\/color>/.exec(
    xml,
  )?.[1];
}

describe('splash background', () => {
  it('is the light theme background by default and the dark one at night', () => {
    expect(expo.splash.backgroundColor).toBe(palette.bg.light);
    expect(expo.android.splash.backgroundColor).toBe(palette.bg.light);
    expect(expo.android.splash.dark?.backgroundColor).toBe(palette.bg.dark);
    expect(splashColour('values')).toBe(palette.bg.light);
    expect(splashColour('values-night')).toBe(palette.bg.dark);
  });
});

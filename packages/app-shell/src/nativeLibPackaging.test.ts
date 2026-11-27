import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const GRADLE_PROPERTIES = join(
  import.meta.dirname,
  '..',
  'android',
  'gradle.properties',
);

function gradleProperty(name: string): string | undefined {
  return readFileSync(GRADLE_PROPERTIES, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

describe('native library packaging', () => {
  it('stores native libraries compressed in the APK', () => {
    expect(gradleProperty('expo.useLegacyPackaging')).toBe('true');
  });
});

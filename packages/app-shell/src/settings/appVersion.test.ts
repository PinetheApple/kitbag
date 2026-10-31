import { expect, it } from 'vitest';

import { formatAppVersion } from './appVersion.ts';

it('shows the version name and the build number', () => {
  expect(formatAppVersion({ versionName: '0.1.0', versionCode: 41 })).toBe(
    '0.1.0 · build 41',
  );
});

it('prints a large version code whole, not in exponent form', () => {
  expect(
    formatAppVersion({ versionName: '1.4.2', versionCode: 4_000_000_042 }),
  ).toBe('1.4.2 · build 4000000042');
});

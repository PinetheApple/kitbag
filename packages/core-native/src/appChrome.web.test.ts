import { expect, it } from 'vitest';

import { getAppVersion } from './appChrome.web.ts';

it('reports a version marked as web, not a native-looking one', () => {
  expect(getAppVersion().versionName).toMatch(/web/i);
});

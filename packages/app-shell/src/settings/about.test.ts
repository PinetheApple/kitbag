import { expect, it } from 'vitest';

import { SOURCE_LABEL, SOURCE_URL } from './about.ts';

it('labels the source row with the whole repository address', () => {
  expect(SOURCE_URL).toBe(`https://${SOURCE_LABEL}`);
});

import { expect, it } from 'vitest';

import {
  databaseFreeBytes,
  removeDatabaseCopy,
  replaceDatabaseCopy,
} from './migrationCopies.web.ts';

it('has no database copies on web', () => {
  expect(databaseFreeBytes('kitbag')).toBe(0);
  expect(() => {
    removeDatabaseCopy('kitbag', 'kitbag.v24.bak');
  }).toThrow();
  expect(() => {
    replaceDatabaseCopy('kitbag', 'kitbag.v24.bak.part', 'kitbag.v24.bak');
  }).toThrow();
});

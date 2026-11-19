import { expect, it } from 'vitest';

import { focusReaderNode } from './readerFocus.web.ts';

it('asks no native module to move reader focus on web', () => {
  const node = {} as Parameters<typeof focusReaderNode>[0];
  expect(() => {
    focusReaderNode(node);
  }).not.toThrow();
});

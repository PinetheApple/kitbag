import { expect, it, vi } from 'vitest';

import { focusReaderOn, setReaderFocuser } from './readerFocus.web.ts';

it('calls no installed focuser on web', () => {
  const focuser = vi.fn();
  setReaderFocuser(focuser);
  focusReaderOn({} as Parameters<typeof focusReaderOn>[0]);
  expect(focuser).not.toHaveBeenCalled();
});

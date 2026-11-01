import { expect, it, vi } from 'vitest';

import { onHardwareBack } from './hardwareBack.web.ts';

it('registers nothing on web, where BackHandler logs a console error', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  onHardwareBack(vi.fn())();
  expect(error).not.toHaveBeenCalled();
});

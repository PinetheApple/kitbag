import { expect, it } from 'vitest';

import {
  dataFolderCodes,
  listVolumes,
  moveStatus,
  startCardReturn,
  startMove,
  watchMove,
} from './dataFolder.web.ts';

it('has no move on web', async () => {
  await expect(moveStatus()).resolves.toBeNull();
  await expect(listVolumes()).rejects.toThrow(/Android/);
  await expect(startMove(null)).rejects.toThrow(/Android/);
  await expect(startCardReturn('1234-ABCD')).rejects.toThrow(/Android/);
  expect(() => dataFolderCodes()).toThrow(/Android/);
  const stop = watchMove({
    progress: () => undefined,
    finished: () => undefined,
  });
  expect(stop).not.toThrow();
});

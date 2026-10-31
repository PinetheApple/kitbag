import { expect, it } from 'vitest';

import { missingFiles, storageReport } from './libraryStorage.web.ts';

it('reports an empty library with no location', async () => {
  await expect(storageReport('kitbag')).resolves.toEqual({
    libraryAudio: { files: 0, bytes: 0 },
    stemSets: { count: 0, bytes: 0 },
    database: { bytes: 0 },
    location: '',
  });
});

it('reports nothing missing', async () => {
  await expect(missingFiles(['songs/a/x.mp3'])).resolves.toEqual([]);
});

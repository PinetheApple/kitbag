import { describe, expect, it } from 'vitest';

import { openBackupDatabase, seed } from './backup.test-helper';
import { GET_SONG_BPM_KEY_PREFERENCE } from './getsongbpm-key-preference';

const PERSONAL_KEY = 'gsb-personal-7f3a9c';

describe('GetSongBPM key and backups', () => {
  it('stays out of an exported backup while staying on the device', async () => {
    const source = openBackupDatabase();
    await seed(source);
    await source.preferences.set(GET_SONG_BPM_KEY_PREFERENCE, PERSONAL_KEY);
    const file = await source.backup.export();
    expect(source.preferences.get(GET_SONG_BPM_KEY_PREFERENCE)).toBe(
      PERSONAL_KEY,
    );
    expect(file).not.toContain(PERSONAL_KEY);
    expect(file).not.toContain(GET_SONG_BPM_KEY_PREFERENCE);
  });
});

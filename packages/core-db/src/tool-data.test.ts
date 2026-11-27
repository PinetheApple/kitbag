import { describe, expect, it } from 'vitest';

import { openBackupDatabase } from './backup.test-helper';
import {
  createToolDataRepository,
  MAX_TOOL_DATA_KEY_BYTES,
  MAX_TOOL_DATA_VALUE_BYTES,
  type ToolDataRejection,
} from './tool-data-repository';

const SAVED_AT = new Date('2026-11-27T10:00:00Z');
const LATER = new Date('2026-11-28T10:00:00Z');

function open(now = () => SAVED_AT) {
  return createToolDataRepository(openBackupDatabase().handle, now);
}

const JSON_STRING_QUOTES = '""'.length;
const E_ACUTE = 'é';
const E_ACUTE_BYTES = new TextEncoder().encode(E_ACUTE).byteLength;

const refused = (reason: ToolDataRejection) => ({ reason });

describe('tool data repository', () => {
  it('stores JSON text per tool and key, unseen by other tools', async () => {
    const repository = open();
    const chords = repository.forTool('chords');
    await chords.set('favourites', '["Am7","Dm9"]');
    await repository.forTool('drone').set('favourites', '{"note":"D"}');
    expect(await chords.get('favourites')).toBe('["Am7","Dm9"]');
    expect(await chords.get('missing')).toBeNull();
    expect(await chords.list()).toEqual([
      { key: 'favourites', value: '["Am7","Dm9"]', updatedAt: SAVED_AT },
    ]);
  });

  it('overwrites a key and moves its time forward', async () => {
    let now = SAVED_AT;
    const chords = open(() => now).forTool('chords');
    await chords.set('level', '1');
    now = LATER;
    await chords.set('level', '2');
    expect(await chords.list()).toEqual([
      { key: 'level', value: '2', updatedAt: LATER },
    ]);
  });

  it('removes one key, and clears one tool without touching another', async () => {
    const repository = open();
    const chords = repository.forTool('chords');
    const drone = repository.forTool('drone');
    await chords.set('a', '1');
    await chords.set('b', '2');
    await drone.set('a', '3');
    await chords.remove('a');
    expect((await chords.list()).map(({ key }) => key)).toEqual(['b']);
    await chords.clear();
    expect(await chords.list()).toEqual([]);
    expect(await drone.get('a')).toBe('3');
  });

  it.each(['', '{', 'undefined', "{'a':1}"])(
    'refuses %j as not JSON and keeps the old value',
    async (value) => {
      const chords = open().forTool('chords');
      await chords.set('k', '1');
      await expect(chords.set('k', value)).rejects.toMatchObject(
        refused('invalidJson'),
      );
      expect(await chords.get('k')).toBe('1');
    },
  );

  it('caps a value by its UTF-8 size', async () => {
    const chords = open().forTool('chords');
    const fits = JSON.stringify(
      'x'.repeat(MAX_TOOL_DATA_VALUE_BYTES - JSON_STRING_QUOTES),
    );
    await chords.set('fits', fits);
    expect(await chords.get('fits')).toBe(fits);
    const multiByte = JSON.stringify(
      E_ACUTE.repeat(MAX_TOOL_DATA_VALUE_BYTES / E_ACUTE_BYTES),
    );
    await expect(chords.set('big', multiByte)).rejects.toMatchObject(
      refused('tooLarge'),
    );
    expect(await chords.get('big')).toBeNull();
  });

  it('caps a key by its UTF-8 size', async () => {
    const chords = open().forTool('chords');
    const longest = 'k'.repeat(MAX_TOOL_DATA_KEY_BYTES);
    await chords.set(longest, '1');
    expect(await chords.get(longest)).toBe('1');
    const multiByte = E_ACUTE.repeat(
      MAX_TOOL_DATA_KEY_BYTES / E_ACUTE_BYTES + 1,
    );
    await expect(chords.set(multiByte, '1')).rejects.toMatchObject(
      refused('keyTooLong'),
    );
  });

  it('refuses an empty tool id or key', async () => {
    const repository = open();
    await expect(repository.forTool('').set('k', '1')).rejects.toMatchObject(
      refused('emptyId'),
    );
    await expect(
      repository.forTool('chords').set('', '1'),
    ).rejects.toMatchObject(refused('emptyId'));
  });
});

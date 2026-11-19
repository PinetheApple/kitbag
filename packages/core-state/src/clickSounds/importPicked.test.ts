import { KB_RESULT } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { CODES } from '../songLibrary/store.test-helper.ts';
import { harness, PICKED, SOURCE } from './store.test-helper.ts';

describe('importing a picked file', () => {
  it('stores it under the file name without its extension', async () => {
    const h = harness();
    const sound = await h.state().importPicked(null);
    expect(sound).toMatchObject({ slot: 0, name: 'Rimshot' });
    expect(h.deps.prepare).toHaveBeenCalledWith(SOURCE, 'file-1.wav');
    expect(h.state().notice).toBeNull();
  });

  it('says which file it is preparing until the import ends', async () => {
    const h = harness();
    const seen: (string | null)[] = [];
    h.deps.prepare.mockImplementationOnce(() => {
      seen.push(h.state().preparing);
      return Promise.resolve(KB_RESULT.KB_OK);
    });
    await h.state().importPicked(null);
    expect(seen).toEqual(['Rimshot.flac']);
    expect(h.state().preparing).toBeNull();
  });

  it('refuses a format song import refuses, naming the supported ones', async () => {
    const h = harness();
    h.deps.pickDocument.mockResolvedValueOnce({
      uri: SOURCE,
      name: 'Snare.m4a',
      mimeType: 'audio/mp4',
    });
    expect(await h.state().importPicked(null)).toBeNull();
    expect(h.deps.prepare).not.toHaveBeenCalled();
    expect(h.state().notice).toEqual({
      kind: 'refused',
      fileName: 'Snare.m4a',
      replacing: null,
      problem: {
        kind: 'format',
        format: 'm4a',
        supported: CODES.supportedAudioFamilies,
      },
    });
  });

  it.each([
    [KB_RESULT.KB_ERROR_TOO_LONG, 'tooLong'],
    [KB_RESULT.KB_ERROR_SILENT, 'silent'],
    [KB_RESULT.KB_ERROR_INVALID_ARGUMENT, 'damaged'],
    [KB_RESULT.KB_ERROR_NO_SPACE, 'noSpace'],
    [KB_RESULT.KB_ERROR_INTERNAL, 'failed'],
  ] as const)('reports core result %i as %s', async (result, kind) => {
    const h = harness();
    h.deps.prepare.mockResolvedValueOnce(result);
    expect(await h.state().importPicked(null)).toBeNull();
    expect(h.state().notice).toMatchObject({ problem: { kind } });
    expect(await h.database.clickSounds.list()).toEqual([]);
  });

  it('names the sound a failed replace kept', async () => {
    const h = harness();
    const kept = await h.state().importPicked(null);
    h.deps.prepare.mockResolvedValueOnce(KB_RESULT.KB_ERROR_TOO_LONG);
    expect(await h.state().importPicked(kept)).toBeNull();
    expect(h.state().notice).toMatchObject({
      replacing: 'Rimshot',
      problem: { kind: 'tooLong' },
    });
    expect(h.state().sounds).toMatchObject([{ name: 'Rimshot' }]);
  });

  it('replaces the slot with the picked file', async () => {
    const h = harness();
    const kept = await h.state().importPicked(null);
    h.deps.pickDocument.mockResolvedValueOnce({ ...PICKED, name: 'Hat.wav' });
    expect(await h.state().importPicked(kept)).toMatchObject({
      slot: 0,
      name: 'Hat',
    });
  });

  it('reports a failed copy as a failed import', async () => {
    const h = harness();
    h.deps.prepare.mockRejectedValueOnce(new Error('E_IMPORT_FAILED'));
    expect(await h.state().importPicked(null)).toBeNull();
    expect(h.state().notice).toMatchObject({ problem: { kind: 'failed' } });
    expect(h.state().importing).toBe(false);
  });

  it('does nothing when the picker is cancelled', async () => {
    const h = harness();
    h.deps.pickDocument.mockResolvedValueOnce(null);
    expect(await h.state().importPicked(null)).toBeNull();
    expect(h.state().notice).toBeNull();
  });

  it('reports a picker that will not open, and clears the notice on dismiss', async () => {
    const h = harness();
    h.deps.pickDocument.mockRejectedValueOnce(new Error('no activity'));
    await h.state().importPicked(null);
    expect(h.state().notice).toEqual({ kind: 'picker' });
    h.state().dismissNotice();
    expect(h.state().notice).toBeNull();
  });

  it('clears the last notice when a new pick starts', async () => {
    const h = harness();
    h.deps.prepare.mockResolvedValueOnce(KB_RESULT.KB_ERROR_SILENT);
    await h.state().importPicked(null);
    await h.state().importPicked(null);
    expect(h.state().notice).toBeNull();
  });
});

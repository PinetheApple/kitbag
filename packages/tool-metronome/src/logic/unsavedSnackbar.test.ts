import { SNACKBAR_DURATION_MS } from '@kitbag/core-design';
import type { DiscardedChanges, SongPreset } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { unsavedSnackbarView } from './unsavedSnackbar.ts';

const DISCARDED_AT = 1_000;
const presets = [{ id: 1, name: 'Ballad in G' }] as unknown as SongPreset[];
const discarded = {
  loaded: { presetId: 1, itemId: 4, setlistId: 2 },
  at: DISCARDED_AT,
} as unknown as DiscardedChanges;

describe('unsavedSnackbarView', () => {
  it('names the song for the full duration right after the discard', () => {
    expect(unsavedSnackbarView(discarded, presets, DISCARDED_AT)).toEqual({
      message: 'Changes to Ballad in G not saved',
      timeLeftMs: SNACKBAR_DURATION_MS,
    });
  });

  it('shows only what is left when the app comes back mid-window', () => {
    const half = SNACKBAR_DURATION_MS / 2;
    expect(
      unsavedSnackbarView(discarded, presets, DISCARDED_AT + half)?.timeLeftMs,
    ).toBe(half);
  });

  it('shows nothing once the window has passed', () => {
    const late = DISCARDED_AT + SNACKBAR_DURATION_MS;
    expect(unsavedSnackbarView(discarded, presets, late)).toBeUndefined();
  });

  it('shows nothing with no discard or a deleted song', () => {
    expect(unsavedSnackbarView(null, presets, DISCARDED_AT)).toBeUndefined();
    expect(unsavedSnackbarView(discarded, [], DISCARDED_AT)).toBeUndefined();
  });
});

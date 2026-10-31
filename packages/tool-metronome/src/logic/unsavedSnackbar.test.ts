import { SNACKBAR_DURATION_MS } from '@kitbag/core-design';
import { describe, expect, it } from 'vitest';

import type { NamedSong } from './setlistChip.ts';
import { unsavedSnackbarView, type DiscardedSong } from './unsavedSnackbar.ts';

const DISCARDED_AT = 1_000;

function song(id: number, name: string): NamedSong {
  return { id, name };
}

function discardedSong(presetId: number, at: number): DiscardedSong {
  return { loaded: { presetId, itemId: 4, setlistId: 2 }, at };
}

const presets = [song(1, 'Ballad in G')];
const discarded = discardedSong(1, DISCARDED_AT);

describe('unsavedSnackbarView', () => {
  it('names the song for the full duration right after the discard', () => {
    expect(unsavedSnackbarView(discarded, presets, DISCARDED_AT)).toEqual({
      message: 'Changes to Ballad in G not saved',
      timeLeftMs: SNACKBAR_DURATION_MS,
    });
  });

  it('runs the full duration when the app was already visible', () => {
    const earlier = DISCARDED_AT - SNACKBAR_DURATION_MS;
    expect(unsavedSnackbarView(discarded, presets, earlier)?.timeLeftMs).toBe(
      SNACKBAR_DURATION_MS,
    );
  });

  it('shows only what is left when the app comes back mid-window', () => {
    const half = SNACKBAR_DURATION_MS / 2;
    expect(
      unsavedSnackbarView(discarded, presets, DISCARDED_AT + half)?.timeLeftMs,
    ).toBe(half);
  });

  it('shows nothing when the app comes back after the window', () => {
    const late = DISCARDED_AT + SNACKBAR_DURATION_MS;
    expect(unsavedSnackbarView(discarded, presets, late)).toBeUndefined();
  });

  it('shows nothing with no discard or a deleted song', () => {
    expect(unsavedSnackbarView(null, presets, DISCARDED_AT)).toBeUndefined();
    expect(unsavedSnackbarView(discarded, [], DISCARDED_AT)).toBeUndefined();
  });
});

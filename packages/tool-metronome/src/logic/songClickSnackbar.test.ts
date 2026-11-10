import { SNACKBAR_DURATION_MS } from '@kitbag/core-design';
import type { ReleasedClick } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  songClickOffMessage,
  songClickSnackbarView,
} from './songClickSnackbar.ts';

const RELEASED_AT = 1_000;
const released: ReleasedClick = { title: 'Everlong', id: 1, at: RELEASED_AT };

describe('songClickOffMessage', () => {
  it('names the song that keeps playing', () => {
    expect(songClickOffMessage('Everlong')).toBe(
      'Song click off. Everlong keeps playing.',
    );
  });
});

describe('songClickSnackbarView', () => {
  it('shows the full window right after the release', () => {
    expect(songClickSnackbarView(released, RELEASED_AT, false)).toEqual({
      message: songClickOffMessage(released.title),
      timeLeftMs: SNACKBAR_DURATION_MS,
    });
  });

  it('shows only what is left when the screen reopens mid-window', () => {
    const half = SNACKBAR_DURATION_MS / 2;
    expect(
      songClickSnackbarView(released, RELEASED_AT + half, false)?.timeLeftMs,
    ).toBe(half);
  });

  it('shows nothing when the screen reopens after the window', () => {
    const late = RELEASED_AT + SNACKBAR_DURATION_MS;
    expect(songClickSnackbarView(released, late, false)).toBeUndefined();
  });

  it('gives way to the unsaved-changes snackbar', () => {
    expect(songClickSnackbarView(released, RELEASED_AT, true)).toBeUndefined();
  });

  it('shows nothing with no release', () => {
    expect(songClickSnackbarView(null, RELEASED_AT, false)).toBeUndefined();
  });
});

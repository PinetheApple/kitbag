import type { ReleasedClick } from '@kitbag/core-state';

import { snackbarTimeLeftMs, type SnackbarView } from './unsavedSnackbar.ts';

export function songClickOffMessage(title: string): string {
  return `Song click off. ${title} keeps playing.`;
}

export function songClickSnackbarView(
  released: ReleasedClick | null,
  visibleSince: number,
  unsavedShown: boolean,
): SnackbarView | undefined {
  if (released === null || unsavedShown) return undefined;
  const timeLeftMs = snackbarTimeLeftMs(released.at, visibleSince);
  if (timeLeftMs <= 0) return undefined;
  return { message: songClickOffMessage(released.title), timeLeftMs };
}

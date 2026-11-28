import { SNACKBAR_DURATION_MS } from './snackbarRoles.ts';

// Back from the background or the screen reopened, the window runs from the
// event, not from now.
export function snackbarTimeLeftMs(at: number, visibleSince: number): number {
  return at + SNACKBAR_DURATION_MS - Math.max(visibleSince, at);
}

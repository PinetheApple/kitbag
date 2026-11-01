import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SNACKBAR_DURATION_MS } from './snackbarRoles.ts';
import { startSnackbarTimer } from './snackbarTimer.ts';

describe('startSnackbarTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('times out after the snackbar duration and not before', () => {
    const onTimeout = vi.fn();
    startSnackbarTimer(SNACKBAR_DURATION_MS, onTimeout);
    vi.advanceTimersByTime(SNACKBAR_DURATION_MS - 1);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('never times out once stopped', () => {
    const onTimeout = vi.fn();
    const stop = startSnackbarTimer(SNACKBAR_DURATION_MS, onTimeout);
    stop();
    vi.advanceTimersByTime(SNACKBAR_DURATION_MS);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});

import { DatabaseOpenError } from '@kitbag/core-db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DATABASE_ERROR_TEXT } from './databaseErrorCopy.ts';

const mocks = vi.hoisted(() => ({
  reopenDatabase: vi.fn(),
  frames: [] as (() => void)[],
}));

vi.mock('./databaseGate', () => ({ reopenDatabase: mocks.reopenDatabase }));

const { reopenAfterFrame, retryNotice } = await import('./useDatabaseRetry.ts');

const STILL_REFUSED = new DatabaseOpenError('newer-version');

function runFrame(): void {
  for (const frame of mocks.frames.splice(0)) frame();
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  mocks.reopenDatabase.mockReset();
  mocks.frames.length = 0;
  vi.stubGlobal('requestAnimationFrame', (frame: () => void) => {
    mocks.frames.push(frame);
    return mocks.frames.length;
  });
});

describe('reopenAfterFrame', () => {
  it('waits one frame before the blocking reopen', async () => {
    mocks.reopenDatabase.mockResolvedValue(undefined);
    const outcome = reopenAfterFrame();
    await settle();

    expect(mocks.reopenDatabase).not.toHaveBeenCalled();
    runFrame();

    await expect(outcome).resolves.toEqual({ kind: 'relaunching' });
    expect(mocks.reopenDatabase).toHaveBeenCalledOnce();
  });

  it('hands back the error of a retry that failed again', async () => {
    mocks.reopenDatabase.mockResolvedValue(STILL_REFUSED);
    const outcome = reopenAfterFrame();
    await settle();
    runFrame();

    await expect(outcome).resolves.toEqual({
      kind: 'failed',
      error: STILL_REFUSED,
    });
  });

  it('reports a relaunch that failed after the database opened', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.reopenDatabase.mockRejectedValue(new Error('no activity'));
    const outcome = reopenAfterFrame();
    await settle();
    runFrame();

    await expect(outcome).resolves.toEqual({ kind: 'relaunchFailed' });
  });
});

describe('retryNotice', () => {
  it('says the data still did not open', () => {
    expect(retryNotice({ kind: 'failed', error: STILL_REFUSED })).toBe(
      DATABASE_ERROR_TEXT.stillFailing,
    );
  });

  it('asks for a manual restart when the relaunch failed', () => {
    expect(retryNotice({ kind: 'relaunchFailed' })).toBe(
      DATABASE_ERROR_TEXT.relaunchFailed,
    );
  });

  it('shows nothing while the app relaunches', () => {
    expect(retryNotice({ kind: 'relaunching' })).toBeNull();
  });
});

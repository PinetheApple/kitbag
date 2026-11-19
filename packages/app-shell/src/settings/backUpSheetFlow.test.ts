import { describe, expect, it, vi } from 'vitest';

import {
  backUpEvent,
  backUpRowValue,
  CLOSED_BACK_UP_SHEET,
  nextBackUpSheet,
  type BackUpSheetState,
} from './backUpSheetFlow.ts';
import { SAVE_FAILED, SHARE_FAILED } from './backupText.ts';

const SUMMARY = '1 setlist · 2 songs';
const OPEN = nextBackUpSheet(CLOSED_BACK_UP_SHEET, 'open');

function after(
  state: BackUpSheetState,
  ...events: Parameters<typeof nextBackUpSheet>[1][]
) {
  return events.reduce(nextBackUpSheet, state);
}

describe('back up sheet flow', () => {
  it('opens on the row and closes once the backup went out', () => {
    expect(OPEN.open).toBe(true);
    expect(after(OPEN, 'start', 'done')).toEqual(CLOSED_BACK_UP_SHEET);
  });

  it('leaves the sheet open and silent when the save dialog is cancelled', () => {
    const cancelled = after(OPEN, 'start', 'cancelled');
    expect(cancelled).toEqual(OPEN);
    expect(backUpRowValue(cancelled, SUMMARY)).toBe(SUMMARY);
  });

  it('shows a failed save or share on the row, the way sharing always has', () => {
    const saveFailed = after(OPEN, 'start', 'saveFailed');
    expect(saveFailed.open).toBe(false);
    expect(backUpRowValue(saveFailed, SUMMARY)).toBe(SAVE_FAILED);
    expect(backUpRowValue(after(OPEN, 'start', 'shareFailed'), SUMMARY)).toBe(
      SHARE_FAILED,
    );
  });

  it('clears an old failure when the sheet opens again', () => {
    const reopened = after(OPEN, 'saveFailed', 'open');
    expect(backUpRowValue(reopened, SUMMARY)).toBe(SUMMARY);
  });

  it('holds the buttons while a backup is going out', () => {
    expect(after(OPEN, 'start').busy).toBe(true);
    expect(after(OPEN, 'start', 'cancelled').busy).toBe(false);
  });
});

describe('backUpEvent', () => {
  it('is done when the backup was saved or shared', async () => {
    await expect(
      backUpEvent('save', () => Promise.resolve(true)),
    ).resolves.toBe('done');
  });

  it('is cancelled, not failed, when the save dialog was dismissed', async () => {
    await expect(
      backUpEvent('save', () => Promise.resolve(false)),
    ).resolves.toBe('cancelled');
  });

  it('names which action failed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const failing = () => Promise.reject(new Error('E_SAVE_FAILED'));
    await expect(backUpEvent('save', failing)).resolves.toBe('saveFailed');
    await expect(backUpEvent('share', failing)).resolves.toBe('shareFailed');
    warn.mockRestore();
  });
});

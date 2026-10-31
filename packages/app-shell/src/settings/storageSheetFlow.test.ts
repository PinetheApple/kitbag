import { describe, expect, it } from 'vitest';

import { nextStorageSheet, showsRemoveMissing } from './storageSheetFlow.ts';

describe('storage sheet flow', () => {
  it('hides the removal chip when nothing is missing', () => {
    expect(showsRemoveMissing(0)).toBe(false);
    expect(showsRemoveMissing(1)).toBe(true);
  });

  it('opens, confirms, then returns to the storage sheet', () => {
    const opened = nextStorageSheet('none', 'open');
    expect(opened).toBe('storage');
    const asked = nextStorageSheet(opened, 'askRemove');
    expect(asked).toBe('confirm');
    expect(nextStorageSheet(asked, 'remove')).toBe('storage');
    expect(nextStorageSheet(asked, 'cancelRemove')).toBe('storage');
    expect(nextStorageSheet(asked, 'dismiss')).toBe('none');
  });

  it('asks for confirmation only from the storage sheet', () => {
    expect(nextStorageSheet('none', 'askRemove')).toBe('none');
    expect(nextStorageSheet('storage', 'remove')).toBe('storage');
  });
});

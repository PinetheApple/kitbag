import { describe, expect, it } from 'vitest';

import { notificationRow } from './notificationText.ts';

describe('playback card row', () => {
  it('is hidden where the platform has no runtime permission', () => {
    expect(
      notificationRow({ required: false, granted: false, ask: 'never' }),
    ).toBeNull();
  });

  it('shows nothing pressable until the permission has been read', () => {
    expect(
      notificationRow({ required: true, granted: undefined, ask: 'asked' }),
    ).toEqual({ value: null, action: 'none' });
  });

  it('reads On, with nothing to do, when granted', () => {
    expect(
      notificationRow({ required: true, granted: true, ask: 'asked' }),
    ).toEqual({ value: 'On', action: 'none' });
  });

  it('reads Off and asks again while the system still shows the dialog', () => {
    expect(
      notificationRow({ required: true, granted: false, ask: 'asked' }),
    ).toEqual({ value: 'Off', action: 'request' });
  });

  it('points at the system settings once the dialog is blocked', () => {
    expect(
      notificationRow({ required: true, granted: false, ask: 'blocked' }),
    ).toEqual({ value: 'Off · open settings', action: 'openSettings' });
  });
});

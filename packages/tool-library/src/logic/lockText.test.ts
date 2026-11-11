import { describe, expect, it } from 'vitest';

import { lockText } from './lockText.ts';

describe('lockText', () => {
  it('headlines the lock while the click runs', () => {
    expect(lockText('grid', true, '158 BPM')).toEqual({
      title: 'Metronome locked',
      detail: '158 BPM · phase auto · from beat grid',
      available: true,
    });
  });

  it('reads click off, grid ready, while the click is off', () => {
    expect(lockText('grid', false, '158 BPM')).toEqual({
      title: 'Click off',
      detail: '158 BPM · grid ready',
      available: true,
    });
    expect(lockText('grid', false, null).detail).toBe('grid ready');
  });

  it.each(['pending', 'analyzing', 'failed', 'noGrid'] as const)(
    'offers no click for a song whose badge is %s',
    (badge) => {
      expect(lockText(badge, false, null)).toMatchObject({
        title: 'No click available',
        available: false,
      });
    },
  );
});

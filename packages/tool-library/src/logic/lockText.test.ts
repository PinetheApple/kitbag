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

  it('claims no lock while the click is off', () => {
    expect(lockText('grid', false, null).title).toBe('Metronome');
    expect(lockText('grid', false, null).available).toBe(true);
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

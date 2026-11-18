import { describe, expect, it } from 'vitest';

import { lockText, statusBadge } from './lockText.ts';

describe('lockText', () => {
  it('headlines the lock while the click runs', () => {
    expect(lockText('grid', true, '158 BPM')).toEqual({
      title: 'Metronome locked',
      detail: '158 BPM · phase auto · from beat grid',
      action: 'click',
    });
  });

  it('reads click off, grid ready, while the click is off', () => {
    expect(lockText('grid', false, '158 BPM')).toEqual({
      title: 'Click off',
      detail: '158 BPM · grid ready',
      action: 'click',
    });
    expect(lockText('grid', false, null).detail).toBe('grid ready');
  });

  it.each(['pending', 'analyzing'] as const)(
    'says the beat is still being found while %s',
    (badge) => {
      expect(lockText(badge, false, null)).toEqual({
        title: 'Finding the beat',
        detail: 'The click is ready once analysis ends',
        action: 'none',
      });
    },
  );

  it('names a failed analysis and offers Re-analyse', () => {
    expect(lockText('failed', false, null)).toEqual({
      title: 'No beat grid',
      detail: 'Analysis failed, so no click',
      action: 'reanalyse',
    });
  });

  it('names an analysis that found no beat and offers Re-analyse', () => {
    expect(lockText('noGrid', false, null)).toEqual({
      title: 'No beat grid',
      detail: 'Analysis found no beat, so no click',
      action: 'reanalyse',
    });
  });
});

describe('statusBadge', () => {
  it.each([
    ['pending', 'ANALYZING'],
    ['analyzing', 'ANALYZING'],
    ['failed', 'NO GRID'],
    ['noGrid', 'NO GRID'],
  ] as const)('reads %s as %s', (badge, label) => {
    expect(statusBadge(badge)?.label).toBe(label);
  });

  it('leaves the bar to the BPM once there is a grid', () => {
    expect(statusBadge('grid')).toBeNull();
  });
});

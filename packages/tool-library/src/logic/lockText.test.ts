import { describe, expect, it } from 'vitest';

import {
  barBadge,
  barStatusOf,
  lockText,
  playerStatusBadge,
} from './lockText.ts';

describe('lockText', () => {
  it('headlines the lock while the click runs', () => {
    expect(lockText('grid', true, '158 BPM', null)).toEqual({
      title: 'Metronome locked',
      detail: '158 BPM · phase auto · from beat grid',
      action: 'click',
    });
  });

  it('reads click off, grid ready, while the click is off', () => {
    expect(lockText('grid', false, '158 BPM', null)).toEqual({
      title: 'Click off',
      detail: '158 BPM · grid ready',
      action: 'click',
    });
    expect(lockText('grid', false, null, null).detail).toBe('grid ready');
  });

  it.each(['pending', 'analyzing'] as const)(
    'says the beat is still being found while %s',
    (badge) => {
      expect(lockText(badge, false, null, null)).toEqual({
        title: 'Finding the beat',
        detail: 'The click is ready once analysis ends',
        action: 'none',
      });
    },
  );

  it('names a failed analysis and offers Re-analyse', () => {
    expect(lockText('failed', false, null, null)).toEqual({
      title: 'No beat grid',
      detail: 'Analysis failed, so no click',
      action: 'reanalyze',
    });
  });

  it('says a file that would not decode may be damaged and offers Re-analyse', () => {
    expect(
      lockText('failed', false, null, { kind: 'damaged', keptGrid: false }),
    ).toEqual({
      title: 'No beat grid',
      detail: 'File may be damaged, so no click',
      action: 'reanalyze',
    });
  });

  it('names an unsupported format and offers no Re-analyse', () => {
    const failure = {
      kind: 'unsupported',
      keptGrid: false,
      format: 'ogg',
      supported: ['WAV'],
    } as const;
    expect(lockText('failed', false, null, failure)).toEqual({
      title: 'No beat grid',
      detail: 'OGG isn’t supported, so no click',
      action: 'none',
    });
  });

  it('names an analysis that found no beat and offers Re-analyse', () => {
    expect(lockText('noGrid', false, null, null)).toEqual({
      title: 'No beat grid',
      detail: 'Analysis found no beat, so no click',
      action: 'reanalyze',
    });
  });
});

describe('playerStatusBadge', () => {
  it('reads an analysis in progress as the list does', () => {
    expect(playerStatusBadge('analyzing')).toMatchObject({
      label: 'ANALYZING',
      tone: 'warning',
    });
  });

  it.each(['failed', 'noGrid'] as const)(
    'reads %s as NO GRID in red',
    (badge) => {
      expect(playerStatusBadge(badge)).toMatchObject({
        label: 'NO GRID',
        tone: 'danger',
      });
    },
  );

  it('leaves the bar to the BPM once there is a grid', () => {
    expect(playerStatusBadge('grid')).toBeNull();
  });
});

describe('the app-bar badge', () => {
  const failed = { analysisStatus: 'failed', beats: [] } as const;

  it('waits for the song to be ready before naming its grid', () => {
    expect(barStatusOf({ ...failed, status: 'loading' })).toBeNull();
    expect(barStatusOf({ ...failed, status: 'ready' })?.label).toBe('NO GRID');
  });

  it('keeps the grid while a re-analysis runs', () => {
    expect(
      barStatusOf({ status: 'ready', analysisStatus: 'analyzing', beats: [0] }),
    ).toBeNull();
  });

  it('shows the status over the BPM, else the BPM', () => {
    const status = playerStatusBadge('analyzing');
    expect(barBadge(status, 120)).toBe(status);
    expect(barBadge(null, 120)?.label).toBe('120 BPM');
    expect(barBadge(null, null)).toBeNull();
  });
});

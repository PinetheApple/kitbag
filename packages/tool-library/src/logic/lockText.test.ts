import { describe, expect, it } from 'vitest';

import {
  barBadge,
  barStatusOf,
  lockIcon,
  lockText,
  type LockTextInput,
  playerStatusBadge,
} from './lockText.ts';

const FULL = 1;
const SLOWED = 0.9;

const lockOf = (input: Partial<LockTextInput>) =>
  lockText({
    badge: 'grid',
    click: false,
    bpmText: null,
    failure: null,
    speed: FULL,
    manual: false,
    ...input,
  });

describe('lockText', () => {
  it('marks a manual tempo, without the phase, while the click runs', () => {
    expect(lockOf({ click: true, bpmText: '128 BPM', manual: true })).toEqual({
      title: 'Metronome locked',
      detail: '128 BPM · manual tempo',
      action: 'click',
    });
  });

  it('marks a manual tempo with the click off', () => {
    expect(lockOf({ bpmText: '66 BPM', manual: true }).detail).toBe(
      '66 BPM · manual tempo',
    );
  });

  it('headlines the lock while the click runs', () => {
    expect(lockOf({ click: true, bpmText: '158 BPM' })).toEqual({
      title: 'Metronome locked',
      detail: '158 BPM · phase auto · from beat grid',
      action: 'click',
    });
  });

  it('names the speed in place of the phase while the song is slowed', () => {
    expect(
      lockOf({ click: true, bpmText: '142 BPM', speed: SLOWED }).detail,
    ).toBe('142 BPM · 90% speed · from beat grid');
  });

  it('reads click off, grid ready, while the click is off', () => {
    expect(lockOf({ bpmText: '158 BPM' })).toEqual({
      title: 'Click off',
      detail: '158 BPM · grid ready',
      action: 'click',
    });
    expect(lockOf({}).detail).toBe('grid ready');
  });

  it.each(['pending', 'analyzing'] as const)(
    'says the beat is still being found while %s',
    (badge) => {
      expect(lockOf({ badge })).toEqual({
        title: 'Finding the beat',
        detail: 'The click is ready once analysis ends',
        action: 'none',
      });
    },
  );

  it('names a failed analysis and offers Re-analyse', () => {
    expect(lockOf({ badge: 'failed' })).toEqual({
      title: 'No beat grid',
      detail: 'Analysis failed, so no click',
      action: 'reanalyze',
    });
  });

  it('says a file that would not decode may be damaged and offers Re-analyse', () => {
    expect(
      lockOf({
        badge: 'failed',
        failure: { kind: 'damaged', keptGrid: false },
      }),
    ).toEqual({
      title: 'No beat grid',
      detail: 'File may be damaged, so no click',
      action: 'reanalyze',
    });
  });

  it.each([
    { kind: 'missingFile', keptGrid: false },
    { kind: 'unsupported', keptGrid: false, format: 'ogg', supported: ['WAV'] },
  ] as const)('offers no Re-analyse where it cannot help: $kind', (failure) => {
    expect(lockOf({ badge: 'failed', failure })).toEqual({
      title: 'No beat grid',
      detail: 'Analysis failed, so no click',
      action: 'none',
    });
  });

  it('names an analysis that found no beat and offers Re-analyse', () => {
    expect(lockOf({ badge: 'noGrid' })).toEqual({
      title: 'No beat grid',
      detail: 'Analysis found no beat, so no click',
      action: 'reanalyze',
    });
  });
});

describe('lockIcon', () => {
  const ACCENT_INK = 'accentDeep';
  const iconOf = (badge: LockTextInput['badge'], click = false) =>
    lockIcon(badge, click, ACCENT_INK);

  it('draws the metronome in accent while the click runs', () => {
    expect(iconOf('grid', true)).toEqual({
      name: 'metronome',
      color: ACCENT_INK,
      border: 'accentDim',
    });
  });

  it('draws the metronome at rest while the click is off', () => {
    expect(iconOf('grid')).toEqual({
      name: 'metronome',
      color: 'text',
      border: 'line',
    });
  });

  it.each(['pending', 'analyzing'] as const)(
    'draws the refresh glyph while %s',
    (badge) => {
      expect(iconOf(badge)).toEqual({
        name: 'analyzing',
        color: 'text',
        border: 'line',
      });
    },
  );

  it.each(['failed', 'noGrid'] as const)(
    'draws the alert in red when there is no grid: %s',
    (badge) => {
      expect(iconOf(badge)).toEqual({
        name: 'error',
        color: 'redInk',
        border: 'line',
      });
    },
  );
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
  const stored = { tempoPreview: null } as const;
  const failed = { ...stored, analysisStatus: 'failed', beats: [] } as const;

  it('waits for the song to be ready before naming its grid', () => {
    expect(barStatusOf({ ...failed, status: 'loading' })).toBeNull();
    expect(barStatusOf({ ...failed, status: 'ready' })?.label).toBe('NO GRID');
  });

  it('keeps the grid while a re-analysis runs', () => {
    expect(
      barStatusOf({
        ...stored,
        status: 'ready',
        analysisStatus: 'analyzing',
        beats: [0],
      }),
    ).toBeNull();
  });

  it('still reads NO GRID while the Set tempo sheet previews a draft grid', () => {
    const previewing = { ...failed, status: 'ready', beats: [0, 1] } as const;
    expect(
      barStatusOf({ ...previewing, tempoPreview: { savedGrid: false } })?.label,
    ).toBe('NO GRID');
    expect(
      barStatusOf({ ...previewing, tempoPreview: { savedGrid: true } }),
    ).toBeNull();
    expect(barStatusOf(previewing)).toBeNull();
  });

  it('shows the status over the BPM, else the BPM', () => {
    const status = playerStatusBadge('analyzing');
    expect(barBadge(status, 120)).toBe(status);
    expect(barBadge(null, 120)?.label).toBe('120 BPM');
    expect(barBadge(null, null)).toBeNull();
  });
});

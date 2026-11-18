import { describe, expect, it } from 'vitest';

import { openingLanes, type JobLanes } from './lanes.ts';

const ALL = ['vocals', 'drums', 'bass', 'guitar', 'piano', 'other'];
const SPLIT = ['lead_vocals', 'backing_vocals'];

function lanes(overrides: Partial<JobLanes>): string[] {
  return openingLanes({
    present: [...ALL, ...SPLIT],
    versions: [],
    openVersion: null,
    vocalSplitChoice: null,
    ...overrides,
  });
}

describe('openingLanes', () => {
  it('sends the open version, in StemDeck lane order', () => {
    const versions = [
      { id: 'main', stems: ALL },
      { id: 'band', stems: ['other', 'drums', 'bass'] },
    ];
    expect(lanes({ versions, openVersion: 'band' })).toEqual([
      'drums',
      'bass',
      'other',
    ]);
  });

  it('falls back to the first version, then to the six stems', () => {
    expect(
      lanes({ versions: [{ id: 'main', stems: ['drums'] }], openVersion: 'x' }),
    ).toEqual(['drums']);
    expect(lanes({})).toEqual(ALL);
  });

  it('swaps vocals for the lead and backing pair only when split was chosen and both exist', () => {
    expect(lanes({ vocalSplitChoice: 'split' })).toEqual([
      ...SPLIT,
      ...ALL.slice(1),
    ]);
    expect(lanes({ vocalSplitChoice: 'combined' })).toEqual(ALL);
    expect(
      lanes({ vocalSplitChoice: 'split', present: [...ALL, 'lead_vocals'] }),
    ).toEqual(ALL);
  });

  it('never sends vocals with the split pair', () => {
    const sent = lanes({ vocalSplitChoice: 'split' });
    expect(sent.includes('vocals') && sent.includes('lead_vocals')).toBe(false);
  });

  it('leaves out a lane with no file on the server', () => {
    expect(lanes({ present: ['drums', 'bass'] })).toEqual(['drums', 'bass']);
    expect(lanes({ present: null })).toEqual(ALL);
  });

  it('keeps vocals out when the open version does not have them', () => {
    const versions = [{ id: 'inst', stems: ['drums', 'bass'] }];
    expect(
      lanes({ versions, openVersion: 'inst', vocalSplitChoice: 'split' }),
    ).toEqual(['drums', 'bass']);
  });
});

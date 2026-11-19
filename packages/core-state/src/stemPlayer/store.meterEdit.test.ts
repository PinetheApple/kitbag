import { GRID_METER, NO_METER_OVERRIDE } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { FALLBACK_BEATS_PER_BAR } from './barMeter.ts';
import { opened, stem } from './store.test-helper.ts';

const THREE_FOUR = [{ beat: 0, beatsPerBar: GRID_METER.triple }];
const OVERRIDE = { meterBeatsPerBar: GRID_METER.quadruple, barOneSeconds: 1 };

describe('the detected meter', () => {
  it('comes from the stored bar marks', async () => {
    const { store } = await opened([stem(1)], { bars: THREE_FOUR });
    expect(store.getState().detectedMeter).toBe(GRID_METER.triple);
  });

  it('stays the detected one under a meter override', async () => {
    const { store } = await opened([stem(1)], {
      bars: THREE_FOUR,
      meterBeatsPerBar: GRID_METER.quadruple,
    });
    expect(store.getState().detectedMeter).toBe(GRID_METER.triple);
  });

  it('falls back to the default bar with no bar marks', async () => {
    const { store } = await opened([stem(1)], { bars: [] });
    expect(store.getState().detectedMeter).toBe(FALLBACK_BEATS_PER_BAR);
  });
});

describe('the detected bar one', () => {
  it('is the first full bar of the stored marks', async () => {
    const { store } = await opened([stem(1)], {
      bars: [{ beat: 1, beatsPerBar: GRID_METER.triple }],
    });
    expect(store.getState().detectedBarOneSeconds).toBe(0.5);
  });

  it('skips a pickup bar', async () => {
    const { store } = await opened([stem(1)], {
      bars: [
        { beat: 0, beatsPerBar: 1 },
        { beat: 1, beatsPerBar: GRID_METER.triple },
      ],
    });
    expect(store.getState().detectedBarOneSeconds).toBe(0.5);
  });

  it('is the first beat with no bar marks', async () => {
    const firstBeat = 0.25;
    const { store } = await opened([stem(1)], {
      bars: [],
      beats: [firstBeat, 0.75, 1.25],
    });
    expect(store.getState().detectedBarOneSeconds).toBe(firstBeat);
  });
});

describe('saving a meter override', () => {
  it('stores it for the given stem song', async () => {
    const { records, store } = await opened([stem(1)]);
    await store.getState().saveMeterOverride(7, OVERRIDE);
    expect(records.saveStemSetMeterOverride).toHaveBeenCalledWith(7, OVERRIDE);
  });

  it('leaves the open song as it was until the change is applied', async () => {
    const { store } = await opened([stem(1)], { bars: THREE_FOUR });
    const before = store.getState().downbeatIndices;
    await store.getState().saveMeterOverride(7, OVERRIDE);
    expect(store.getState().meterOverride).toEqual(NO_METER_OVERRIDE);
    expect(store.getState().downbeatIndices).toBe(before);
  });
});

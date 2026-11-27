import { GRID_METER, NO_METER_OVERRIDE } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { meterSaved, opened, stem } from './store.test-helper.ts';

const MANUAL = { bpm: 120, anchor: 0.5, beatsPerBar: GRID_METER.quadruple };
const PERIOD_SEC = 0.5;
const OVERRIDE = { meterBeatsPerBar: GRID_METER.triple, barOneSeconds: 1 };

const noGrid = () =>
  opened([stem(1)], { beats: [], bars: [], bpm: null, ...OVERRIDE });

describe('a manual tempo on a stem song', () => {
  it('gives a song with no grid a constant grid from bar 1', async () => {
    const song = await noGrid();
    expect(await song.store.getState().setManualTempo(MANUAL)).toBe(true);
    expect(song.records.saveStemSetManualTempo).toHaveBeenCalledWith(7, {
      manualTempo: MANUAL,
      meterOverride: NO_METER_OVERRIDE,
    });
    const { beats, downbeatIndices, facts, manualTempo, meterOverride } =
      song.store.getState();
    expect({ manualTempo, meterOverride }).toEqual({
      manualTempo: MANUAL,
      meterOverride: NO_METER_OVERRIDE,
    });
    expect(beats.slice(0, 2)).toEqual([0, PERIOD_SEC]);
    expect(beats[downbeatIndices[0] ?? -1]).toBe(MANUAL.anchor);
    expect(facts.bpm?.value).toBe(String(MANUAL.bpm));
    expect(song.runtime.library.refresh).toHaveBeenCalled();
  });

  it('undoes back to no grid and the meter it replaced', async () => {
    const song = await noGrid();
    await song.store.getState().setManualTempo(MANUAL);
    expect(await song.store.getState().undoTempo()).toBe(true);
    expect(song.records.saveStemSetManualTempo).toHaveBeenLastCalledWith(7, {
      manualTempo: null,
      meterOverride: OVERRIDE,
    });
    expect(song.store.getState()).toMatchObject({
      manualTempo: null,
      meterOverride: OVERRIDE,
      beats: [],
      tempoUndoable: false,
    });
  });

  it('is not offered on a stem song that has a grid', async () => {
    const song = await opened([stem(1)]);
    const { beats } = song.store.getState();
    expect(await song.store.getState().setManualTempo(MANUAL)).toBe(false);
    expect(song.records.saveStemSetManualTempo).not.toHaveBeenCalled();
    expect(song.store.getState().beats).toBe(beats);
  });

  it('stays editable on a gridded song that kept its manual tempo through a re-import', async () => {
    const song = await opened([stem(1)], { manualTempo: MANUAL });
    const changed = { ...MANUAL, bpm: 66 };
    expect(await song.store.getState().setManualTempo(changed)).toBe(true);
    expect(song.store.getState().manualTempo).toEqual(changed);
  });

  it('keeps a late bar 1 a downbeat under a meter-only override', async () => {
    const late = { ...MANUAL, anchor: 10 };
    const song = await opened([stem(1, { durationSec: 20 })], {
      beats: [],
      bars: [],
      manualTempo: late,
    });
    expect(song.store.getState().detectedBarOneSeconds).toBe(late.anchor);
    const triple = { meterBeatsPerBar: GRID_METER.triple, barOneSeconds: null };
    meterSaved(song.store, triple);
    const { beats, downbeatIndices } = song.store.getState();
    const downbeats = downbeatIndices.map((i) => beats[i]);
    expect(downbeats).toContain(late.anchor);
    expect(downbeats).toContain(late.anchor + 3 * PERIOD_SEC);
  });

  it('opens a stem song with a late bar 1 and a stored meter-only override counting from it', async () => {
    const late = { ...MANUAL, anchor: 10 };
    const song = await opened([stem(1, { durationSec: 20 })], {
      beats: [],
      bars: [],
      manualTempo: late,
      meterBeatsPerBar: GRID_METER.triple,
      barOneSeconds: null,
    });
    const { beats, downbeatIndices } = song.store.getState();
    expect(downbeatIndices.map((i) => beats[i])).toContain(late.anchor);
  });

  it('opens a stored manual tempo as the grid', async () => {
    const song = await opened([stem(1)], {
      beats: [],
      bars: [],
      manualTempo: MANUAL,
    });
    expect(song.store.getState()).toMatchObject({ manualTempo: MANUAL });
    expect(song.store.getState().beats[1]).toBe(PERIOD_SEC);
  });
});

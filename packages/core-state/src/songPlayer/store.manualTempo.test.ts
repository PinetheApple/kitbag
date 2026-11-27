import {
  GRID_METER,
  NO_METER_OVERRIDE,
  TEMPO_CORRECTION,
  type LibraryRow,
  type SongRecord,
} from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import { songRow } from '../storage/fixtures.test-helper.ts';
import { opened, songRecord } from './store.test-helper.ts';

const ANALYSED_BPM = 120;
const MANUAL = { bpm: 120, anchor: 0.5, beatsPerBar: GRID_METER.quadruple };
const PERIOD_SEC = 0.5;
const OVERRIDE = { meterBeatsPerBar: GRID_METER.triple, barOneSeconds: 1.5 };

const NO_GRID = songRecord({
  analysisStatus: 'failed',
  bpm: null,
  beats: [],
  downbeatIndices: [],
});
const ANALYSED = songRecord({ bpm: ANALYSED_BPM });

type Opened = Awaited<ReturnType<typeof opened>>;

function reanalysed(song: Opened, record: SongRecord) {
  song.records.readSong.mockResolvedValue(record);
  song.library.setState({
    rows: [
      songRow({ id: record.id, analysisStatus: record.analysisStatus }),
    ] as readonly LibraryRow[],
  });
}

describe('setting a manual tempo', () => {
  it('stores it and runs the click on a constant grid from bar 1', async () => {
    const song = await opened(NO_GRID);
    expect(await song.player.getState().setManualTempo(MANUAL)).toBe(true);
    expect(song.records.saveSongManualTempo).toHaveBeenCalledWith(NO_GRID.id, {
      manualTempo: MANUAL,
      meterOverride: NO_METER_OVERRIDE,
    });
    const { beats, downbeatIndices, bpm, manualTempo } = song.player.getState();
    expect({ bpm, manualTempo }).toEqual({
      bpm: MANUAL.bpm,
      manualTempo: MANUAL,
    });
    expect(beats.slice(0, 3)).toEqual([0, PERIOD_SEC, 2 * PERIOD_SEC]);
    expect(beats.at(-1)).toBe(NO_GRID.durationSec);
    expect(downbeatIndices.slice(0, 2).map((i) => beats[i])).toEqual([
      MANUAL.anchor,
      MANUAL.anchor + MANUAL.beatsPerBar * PERIOD_SEC,
    ]);
    expect(song.runtime.library.refresh).toHaveBeenCalled();
    await song.player.getState().toggleClick();
    expect(song.commands.setGrid).toHaveBeenLastCalledWith(
      beats,
      downbeatIndices,
      0,
    );
  });

  it('is not corrected by the analysed tempo correction', async () => {
    const song = await opened({
      ...ANALYSED,
      tempoCorrection: TEMPO_CORRECTION.double,
    });
    expect(song.player.getState().bpm).toBe(ANALYSED_BPM * 2);
    await song.player.getState().setManualTempo(MANUAL);
    expect(song.player.getState().bpm).toBe(MANUAL.bpm);
    expect(song.player.getState().beats[1]).toBe(PERIOD_SEC);
  });

  it('replaces the meter override, and Undo brings it and the analysed grid back', async () => {
    const song = await opened({ ...ANALYSED, ...OVERRIDE });
    const before = song.player.getState();
    await song.player.getState().setManualTempo(MANUAL);
    expect(song.player.getState()).toMatchObject({
      meterOverride: NO_METER_OVERRIDE,
      tempoUndoable: true,
    });
    expect(await song.player.getState().undoTempo()).toBe(true);
    expect(song.records.saveSongManualTempo).toHaveBeenLastCalledWith(
      ANALYSED.id,
      { manualTempo: null, meterOverride: OVERRIDE },
    );
    expect(song.player.getState()).toMatchObject({
      manualTempo: null,
      meterOverride: OVERRIDE,
      bpm: before.bpm,
      beats: before.beats,
      downbeatIndices: before.downbeatIndices,
      tempoUndoable: false,
    });
  });

  it('offers nothing to undo once the snackbar is dismissed', async () => {
    const song = await opened(NO_GRID);
    await song.player.getState().setManualTempo(MANUAL);
    song.player.getState().dismissTempoUndo();
    expect(song.player.getState().tempoUndoable).toBe(false);
    expect(await song.player.getState().undoTempo()).toBe(false);
    expect(song.records.saveSongManualTempo).toHaveBeenCalledOnce();
  });

  it('keeps the screen as it was when the save fails', async () => {
    const song = await opened(NO_GRID);
    song.records.saveSongManualTempo.mockRejectedValueOnce(new Error('full'));
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await song.player.getState().setManualTempo(MANUAL)).toBe(false);
    expect(song.player.getState()).toMatchObject({
      manualTempo: null,
      beats: [],
      tempoUndoable: false,
    });
  });
});

describe('the analysed tempo behind a manual one', () => {
  it('is named, and switching to it keeps the meter and can be undone', async () => {
    const song = await opened({ ...ANALYSED, manualTempo: MANUAL });
    expect(song.player.getState()).toMatchObject({
      manualTempo: MANUAL,
      analysedBpm: ANALYSED_BPM,
    });
    expect(await song.player.getState().useAnalysedTempo()).toBe(true);
    expect(song.records.saveSongManualTempo).toHaveBeenLastCalledWith(
      ANALYSED.id,
      { manualTempo: null, meterOverride: NO_METER_OVERRIDE },
    );
    expect(song.player.getState()).toMatchObject({
      manualTempo: null,
      beats: ANALYSED.beats,
      bpm: ANALYSED_BPM,
    });
    await song.player.getState().undoTempo();
    expect(song.player.getState().manualTempo).toEqual(MANUAL);
  });

  it('does not exist for a song analysis found no beat in', async () => {
    const song = await opened({ ...NO_GRID, manualTempo: MANUAL });
    expect(song.player.getState().analysedBpm).toBeNull();
    expect(await song.player.getState().useAnalysedTempo()).toBe(false);
    expect(song.records.saveSongManualTempo).not.toHaveBeenCalled();
  });
});

describe('a re-analysis under a manual tempo', () => {
  it('offers the grid it found and keeps the manual one in use', async () => {
    const song = await opened({ ...NO_GRID, manualTempo: MANUAL });
    const manualBeats = song.player.getState().beats;
    reanalysed(song, { ...ANALYSED, manualTempo: MANUAL });
    await vi.waitFor(() => {
      expect(song.player.getState().analysedOffer).toBe(ANALYSED_BPM);
    });
    expect(song.player.getState()).toMatchObject({
      manualTempo: MANUAL,
      beats: manualBeats,
      bpm: MANUAL.bpm,
    });
    song.player.getState().dismissAnalysedOffer();
    expect(song.player.getState()).toMatchObject({
      analysedOffer: null,
      analysedBpm: ANALYSED_BPM,
    });
  });

  it('offers nothing when it fails again', async () => {
    const song = await opened({ ...NO_GRID, manualTempo: MANUAL });
    const manualBeats = song.player.getState().beats;
    reanalysed(song, { ...NO_GRID, manualTempo: MANUAL, title: 'Again' });
    await vi.waitFor(() => {
      expect(song.player.getState().title).toBe('Again');
    });
    expect(song.player.getState()).toMatchObject({
      analysedOffer: null,
      manualTempo: MANUAL,
      beats: manualBeats,
    });
  });
});

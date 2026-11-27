import { GRID_METER } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { opened, songRecord } from './store.test-helper.ts';

const DRAFT = { bpm: 120, anchor: 0.5, beatsPerBar: GRID_METER.quadruple };
const PERIOD_SEC = 0.5;

const NO_GRID = songRecord({
  analysisStatus: 'failed',
  bpm: null,
  beats: [],
  downbeatIndices: [],
});
const ANALYSED = songRecord({ bpm: 132 });

describe('previewing a tempo in the Set tempo sheet', () => {
  it('runs the click on the draft grid without storing it', async () => {
    const song = await opened(NO_GRID);
    song.player.getState().previewTempo(DRAFT);
    const { beats, downbeatIndices, tempoPreview, manualTempo } =
      song.player.getState();
    expect({ tempoPreview, manualTempo }).toEqual({
      tempoPreview: true,
      manualTempo: null,
    });
    expect(beats.slice(0, 2)).toEqual([0, PERIOD_SEC]);
    expect(beats[downbeatIndices[0] ?? -1]).toBe(DRAFT.anchor);
    await song.player.getState().toggleClick();
    expect(song.commands.setGrid).toHaveBeenLastCalledWith(
      beats,
      downbeatIndices,
      0,
    );
    expect(song.records.saveSongManualTempo).not.toHaveBeenCalled();
  });

  it('puts the stored grid back and stops a click the preview started', async () => {
    const song = await opened(NO_GRID);
    song.player.getState().previewTempo(DRAFT);
    await song.player.getState().toggleClick();
    song.player.getState().previewTempo(null);
    expect(song.player.getState()).toMatchObject({
      beats: [],
      click: false,
      tempoPreview: false,
    });
  });

  it('stops a click the preview started on an analysed song', async () => {
    const song = await opened(ANALYSED);
    song.player.getState().previewTempo(DRAFT);
    await song.player.getState().toggleClick();
    song.player.getState().previewTempo(null);
    expect(song.player.getState()).toMatchObject({
      beats: ANALYSED.beats,
      click: false,
    });
  });

  it('leaves a click that was already running on the analysed grid', async () => {
    const song = await opened(ANALYSED);
    await song.player.getState().toggleClick();
    song.player.getState().previewTempo(DRAFT);
    song.player.getState().previewTempo(null);
    expect(song.player.getState()).toMatchObject({
      beats: ANALYSED.beats,
      click: true,
    });
  });

  it('keeps the saved grid when the sheet closes after Save', async () => {
    const song = await opened(NO_GRID);
    song.player.getState().previewTempo(DRAFT);
    await song.player.getState().toggleClick();
    await song.player.getState().setManualTempo(DRAFT);
    const saved = song.player.getState().beats;
    song.player.getState().previewTempo(null);
    expect(song.player.getState()).toMatchObject({
      beats: saved,
      click: true,
      tempoPreview: false,
      manualTempo: DRAFT,
    });
  });
});

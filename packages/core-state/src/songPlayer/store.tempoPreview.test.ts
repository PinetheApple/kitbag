import { GRID_METER, type LibraryRow, type SongRecord } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import { songRow } from '../storage/fixtures.test-helper.ts';
import { opened, songRecord } from './store.test-helper.ts';

const DRAFT = { bpm: 120, anchor: 0.5, beatsPerBar: GRID_METER.quadruple };
const PERIOD_SEC = 0.5;
const ANALYSED_BPM = 132;

const NO_GRID = songRecord({
  analysisStatus: 'failed',
  bpm: null,
  beats: [],
  downbeatIndices: [],
});
const ANALYSED = songRecord({ bpm: ANALYSED_BPM });

type Opened = Awaited<ReturnType<typeof opened>>;

async function previewed(record: SongRecord) {
  const song = await opened(record);
  song.player.getState().previewTempo(DRAFT);
  await vi.waitFor(() => {
    expect(song.player.getState().click).toBe(true);
  });
  return song;
}

async function refreshed(song: Opened, record: SongRecord) {
  song.records.readSong.mockResolvedValue(record);
  song.library.setState({
    rows: [
      songRow({ id: record.id, analysisStatus: record.analysisStatus }),
    ] as readonly LibraryRow[],
  });
  await vi.waitFor(() => {
    expect(song.player.getState().title).toBe(record.title);
  });
}

describe('previewing a tempo in the Set tempo sheet', () => {
  it('runs the click on the draft grid without storing it', async () => {
    const song = await previewed(NO_GRID);
    const { beats, downbeatIndices, tempoPreview, manualTempo } =
      song.player.getState();
    expect({ tempoPreview, manualTempo }).toEqual({
      tempoPreview: { savedGrid: false },
      manualTempo: null,
    });
    expect(beats.slice(0, 2)).toEqual([0, PERIOD_SEC]);
    expect(beats[downbeatIndices[0] ?? -1]).toBe(DRAFT.anchor);
    expect(song.commands.setGrid).toHaveBeenLastCalledWith(
      beats,
      downbeatIndices,
      0,
    );
    expect(song.records.saveSongManualTempo).not.toHaveBeenCalled();
  });

  it('turns the click on only when it opens, so the chip can turn it off', async () => {
    const song = await previewed(NO_GRID);
    await song.player.getState().toggleClick();
    song.player.getState().previewTempo({ ...DRAFT, bpm: 121 });
    await new Promise((settled) => {
      setTimeout(settled);
    });
    expect(song.player.getState().click).toBe(false);
  });

  it('knows an analysed song has a saved grid behind the draft', async () => {
    const song = await previewed({ ...ANALYSED, bpm: null });
    expect(song.player.getState().tempoPreview).toEqual({ savedGrid: true });
  });

  it('puts the stored grid back and stops the click it started', async () => {
    const song = await previewed(NO_GRID);
    song.player.getState().previewTempo(null);
    expect(song.player.getState()).toMatchObject({
      beats: [],
      click: false,
      tempoPreview: null,
    });
  });

  it('stops the click it started on an analysed song', async () => {
    const song = await previewed(ANALYSED);
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

  it('keeps the draft grid through a library refresh', async () => {
    const song = await previewed(NO_GRID);
    const draftBeats = song.player.getState().beats;
    await refreshed(song, { ...NO_GRID, title: 'Renamed' });
    expect(song.player.getState()).toMatchObject({
      beats: draftBeats,
      tempoPreview: { savedGrid: false },
    });
  });

  it('keeps the saved grid when the sheet closes after Save', async () => {
    const song = await previewed(NO_GRID);
    await song.player.getState().setManualTempo(DRAFT);
    const saved = song.player.getState().beats;
    song.player.getState().previewTempo(null);
    expect(song.player.getState()).toMatchObject({
      beats: saved,
      click: true,
      tempoPreview: null,
      manualTempo: DRAFT,
    });
  });

  it('keeps the click off after Save when the Preview chip turned it off', async () => {
    const song = await previewed(NO_GRID);
    await song.player.getState().toggleClick();
    await song.player.getState().setManualTempo(DRAFT);
    song.player.getState().previewTempo(null);
    expect(song.player.getState()).toMatchObject({
      click: false,
      manualTempo: DRAFT,
    });
  });
});

describe('offering the analysed tempo after a re-analysis', () => {
  it('offers an analysed tempo the manual one differs from', async () => {
    const song = await opened({ ...ANALYSED, manualTempo: DRAFT });
    song.player.getState().offerAnalysed();
    expect(song.player.getState().analysedOffer).toBe(ANALYSED_BPM);
  });

  it('offers nothing when they agree', async () => {
    const song = await opened({
      ...ANALYSED,
      bpm: DRAFT.bpm,
      manualTempo: DRAFT,
    });
    song.player.getState().offerAnalysed();
    expect(song.player.getState().analysedOffer).toBeNull();
  });
});

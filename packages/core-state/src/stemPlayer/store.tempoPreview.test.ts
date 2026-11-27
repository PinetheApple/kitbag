import { GRID_METER } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import { MANUAL_TEMPO_FACT, NO_CLICK_FACT } from './facts.ts';
import { opened, stem } from './store.test-helper.ts';

const DRAFT = { bpm: 120, anchor: 0.5, beatsPerBar: GRID_METER.quadruple };
const PERIOD_SEC = 0.5;

const noGrid = () =>
  opened([stem(1)], { beats: [], bars: [], bpm: null, tempoStability: 90 });

async function previewed() {
  const song = await noGrid();
  song.store.getState().previewTempo(DRAFT);
  await vi.waitFor(() => {
    expect(song.store.getState().click).toBe(true);
  });
  return song;
}

describe('a stem song with no grid', () => {
  it('says there is no click in place of the tempo stability', async () => {
    const song = await noGrid();
    expect(song.store.getState().facts.tempo).toEqual(NO_CLICK_FACT);
  });

  it('says the tempo is manual once one is saved', async () => {
    const song = await noGrid();
    await song.store.getState().setManualTempo(DRAFT);
    const { facts } = song.store.getState();
    expect(facts.tempo).toEqual(MANUAL_TEMPO_FACT);
    expect(facts.bpm?.value).toBe(String(DRAFT.bpm));
  });
});

describe('previewing a tempo on a stem song', () => {
  it('runs the click on the draft grid without storing it or changing the facts', async () => {
    const before = (await noGrid()).store.getState().facts;
    const song = await previewed();
    const { beats, downbeatIndices, tempoPreview, manualTempo, facts } =
      song.store.getState();
    expect({ tempoPreview, manualTempo }).toEqual({
      tempoPreview: { savedGrid: false },
      manualTempo: null,
    });
    expect(beats.slice(0, 2)).toEqual([0, PERIOD_SEC]);
    expect(beats[downbeatIndices[0] ?? -1]).toBe(DRAFT.anchor);
    expect(facts).toEqual(before);
    expect(song.records.saveStemSetManualTempo).not.toHaveBeenCalled();
  });

  it('puts the stored grid back and stops the click it started', async () => {
    const song = await previewed();
    song.store.getState().previewTempo(null);
    expect(song.store.getState()).toMatchObject({
      beats: [],
      click: false,
      tempoPreview: null,
    });
  });

  it('turns the click on only when it opens, so the chip can turn it off', async () => {
    const song = await previewed();
    await song.store.getState().toggleClick();
    song.store.getState().previewTempo({ ...DRAFT, bpm: 121 });
    await new Promise((settled) => {
      setTimeout(settled);
    });
    expect(song.store.getState().click).toBe(false);
  });

  it('keeps the saved grid and the running click when the sheet closes after Save', async () => {
    const song = await previewed();
    await song.store.getState().setManualTempo(DRAFT);
    const saved = song.store.getState().beats;
    song.store.getState().previewTempo(null);
    expect(song.store.getState()).toMatchObject({
      beats: saved,
      click: true,
      tempoPreview: null,
      manualTempo: DRAFT,
    });
  });

  it('keeps the click off after Save when the Preview chip turned it off', async () => {
    const song = await previewed();
    await song.store.getState().toggleClick();
    await song.store.getState().setManualTempo(DRAFT);
    song.store.getState().previewTempo(null);
    expect(song.store.getState()).toMatchObject({
      click: false,
      manualTempo: DRAFT,
    });
  });

  it('forgets the preview when another song opens', async () => {
    const song = await previewed();
    await song.store.getState().open(8, 0);
    expect(song.store.getState().tempoPreview).toBeNull();
  });
});

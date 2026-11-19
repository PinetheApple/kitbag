import type { LoggedSettings } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import { COUNT_IN_SCOPE } from '../metronome/countInScope.ts';
import { repeatPlanOf } from './repeat.ts';
import { COUNT_IN, gig } from './repeat.test-helper.ts';
import { createRepeatOverlay } from './repeatOverlay.ts';

const USER_COUNT_IN = { bars: 1, distinct: false, sound: 0 } as const;

async function repeating() {
  const g = await gig();
  g.metronome.getState().setCountIn(USER_COUNT_IN);
  const applySettings = vi.fn<(settings: LoggedSettings) => void>();
  const overlay = createRepeatOverlay({
    library: g.library,
    metronome: g.metronome,
    applySettings,
  });
  const countIn = () => g.metronome.getState().countIn;
  return { ...g, overlay, applySettings, countIn };
}

describe('Repeat overlay, setlist still there', () => {
  it('loads song 1 of the setlist with the logged count-in and writes nothing', async () => {
    const r = await repeating();
    const presets = r.library.getState().presets;
    const plan = repeatPlanOf(r.log([70, 80, 90]), r.library.getState());
    if (plan === null) throw new Error('no plan');
    await r.overlay.start(plan);
    expect(r.library.getState().loaded).toMatchObject({
      presetId: r.first.id,
      setlistId: r.setlistId,
    });
    expect(r.countIn()).toEqual(COUNT_IN);
    expect(r.library.getState().presets).toEqual(presets);
  });

  it.each([
    [
      'leaving the setlist',
      (r: Awaited<ReturnType<typeof repeating>>) =>
        r.library.getState().leaveSetlist(),
    ],
    [
      'clearing the song',
      (r: Awaited<ReturnType<typeof repeating>>) => {
        r.library.getState().clearSong();
        return Promise.resolve();
      },
    ],
    [
      'loading a song from outside the plan',
      (r: Awaited<ReturnType<typeof repeating>>) =>
        r.library.getState().loadSong(r.first.id),
    ],
  ])('clears on %s and gives back the user count-in', async (_, leave) => {
    const r = await repeating();
    const plan = repeatPlanOf(r.log([70, 80, 90]), r.library.getState());
    if (plan === null) throw new Error('no plan');
    await r.overlay.start(plan);
    await leave(r);
    expect(r.overlay.state.getState().plan).toBeNull();
    expect(r.countIn()).toMatchObject({
      distinct: USER_COUNT_IN.distinct,
      sound: USER_COUNT_IN.sound,
    });
    expect(r.overlay.presetFor(r.second, r.setlistId).bpm).toBe(r.second.bpm);
  });

  it('gives the user bars back too when the count-in plays before every song', async () => {
    const r = await repeating();
    r.metronome.getState().setCountInScope(COUNT_IN_SCOPE.always);
    const plan = repeatPlanOf(r.log([70, 80, 90]), r.library.getState());
    if (plan === null) throw new Error('no plan');
    await r.overlay.start(plan);
    expect(r.countIn()).toEqual(COUNT_IN);
    await r.library.getState().leaveSetlist();
    expect(r.countIn()).toEqual(USER_COUNT_IN);
  });

  it('keeps the overlay while stepping through the planned setlist', async () => {
    const r = await repeating();
    const plan = repeatPlanOf(r.log([70, 80, 90]), r.library.getState());
    if (plan === null) throw new Error('no plan');
    await r.overlay.start(plan);
    r.metronome.getState().setCountIn(USER_COUNT_IN);
    await r.library.getState().stepSong(1);
    expect(r.library.getState().loaded?.presetId).toBe(r.second.id);
    expect(r.overlay.state.getState().plan).toBe(plan);
    expect(r.countIn()).toEqual(COUNT_IN);
  });
});

describe('Repeat overlay, setlist deleted', () => {
  it('applies the first stretch as free play, then restores on the next song', async () => {
    const r = await repeating();
    const log = r.log([70, 80, 90]);
    await r.library.getState().deleteSetlist(r.setlistId);
    const plan = repeatPlanOf(log, r.library.getState());
    if (plan === null) throw new Error('no plan');
    await r.overlay.start(plan);
    expect(r.library.getState().loaded).toBeNull();
    expect(r.applySettings).toHaveBeenCalledWith(log.stretches[0]?.settings);
    expect(r.countIn()).toEqual(COUNT_IN);
    await r.library.getState().loadSong(r.second.id);
    expect(r.overlay.state.getState().plan).toBeNull();
    expect(r.countIn()).toMatchObject({ distinct: false, sound: 0 });
  });
});

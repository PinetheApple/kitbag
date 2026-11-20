import { describe, expect, it } from 'vitest';

import {
  REPEAT_PLAN,
  repeatPlanOf,
  SESSION_LOAD,
  sessionLoadOf,
  type RepeatPlan,
} from './repeat.ts';
import { COUNT_IN, gig, stretchOf } from './repeat.test-helper.ts';
import { overlaidPreset } from './repeatOverlay.ts';

function setlistPlan(plan: RepeatPlan | null) {
  if (plan?.kind !== REPEAT_PLAN.setlist) throw new Error('not a setlist plan');
  return plan;
}

describe('repeatPlanOf', () => {
  it('loads the setlist at its first song with each song as first played', async () => {
    const g = await gig();
    const plan = setlistPlan(
      repeatPlanOf(g.log([70, 80, 90]), g.library.getState()),
    );
    expect(plan.load).toEqual({
      kind: SESSION_LOAD.setlist,
      setlistId: g.setlistId,
      name: 'Gig',
      presetId: g.first.id,
      itemId: g.entries[0]?.item.id,
    });
    expect(plan.songs.get(g.second.uuid)?.settings.bpm).toBe(70);
    expect(plan.songs.get(g.first.uuid)?.settings.bpm).toBe(80);
    expect(plan.songs.get(g.second.uuid)?.countIn).toEqual(COUNT_IN);
  });

  it('overlays the first stretch settings on a planned song and nothing else', async () => {
    const g = await gig();
    const plan = repeatPlanOf(g.log([70, 80, 90]), g.library.getState());
    expect(overlaidPreset(plan, g.second, g.setlistId)).toMatchObject({
      id: g.second.id,
      uuid: g.second.uuid,
      name: 'Second',
      bpm: 70,
    });
    const other = { ...g.first, uuid: 'not-played' };
    expect(overlaidPreset(plan, other, g.setlistId)).toBe(other);
    expect(overlaidPreset(null, g.first, g.setlistId)).toBe(g.first);
    expect(overlaidPreset(plan, g.second, null)).toBe(g.second);
  });

  it('falls back to free play from the first stretch once the setlist is gone', async () => {
    const g = await gig();
    const log = g.log([70, 80, 90]);
    await g.library.getState().deleteSetlist(g.setlistId);
    const plan = repeatPlanOf(log, g.library.getState());
    expect(plan?.kind).toBe(REPEAT_PLAN.freePlay);
    if (plan?.kind !== REPEAT_PLAN.freePlay) return;
    expect(plan.setup.settings.bpm).toBe(70);
    expect(plan.setup.countIn).toEqual(COUNT_IN);
  });

  it('plays a click-only session back as free play', async () => {
    const g = await gig();
    const config = g.metronome.getState();
    const plan = repeatPlanOf(
      { v: 1, stretches: [stretchOf(config, 0, null, null, 84)] },
      g.library.getState(),
    );
    expect(plan).toMatchObject({ kind: REPEAT_PLAN.freePlay });
    expect(plan?.kind === REPEAT_PLAN.freePlay && plan.setup.settings.bpm).toBe(
      84,
    );
  });

  it('has nothing to repeat when no stretch kept its settings', async () => {
    const g = await gig();
    const config = g.metronome.getState();
    const stem = {
      ...stretchOf(config, 0, { stemSongKey: 'k', title: 'Stems' }, null, 90),
      settings: null,
      countIn: null,
    };
    expect(
      repeatPlanOf({ v: 1, stretches: [stem] }, g.library.getState()),
    ).toBeNull();
  });
});

describe('sessionLoadOf', () => {
  const listing = {
    uuid: 's',
    startedAt: new Date(0),
    durationSeconds: 60,
    avgBpm: 100,
    setlistName: null,
  };

  it('loads the setlist an old session points at', async () => {
    const g = await gig();
    const load = sessionLoadOf(
      { ...listing, setlistId: g.setlistId, songUuids: [] },
      g.library.getState(),
    );
    expect(load).toMatchObject({ kind: SESSION_LOAD.setlist, name: 'Gig' });
  });

  it('loads the single song when there is no setlist left', async () => {
    const g = await gig();
    const load = sessionLoadOf(
      { ...listing, setlistId: null, songUuids: [g.first.uuid] },
      g.library.getState(),
    );
    expect(load).toEqual({
      kind: SESSION_LOAD.song,
      presetId: g.first.id,
      name: 'First',
    });
  });

  it('has nothing to load for several loose songs or a deleted one', async () => {
    const g = await gig();
    const state = g.library.getState();
    const loose = { ...listing, setlistId: null };
    expect(
      sessionLoadOf(
        { ...loose, songUuids: [g.first.uuid, g.second.uuid] },
        state,
      ),
    ).toBeNull();
    expect(sessionLoadOf({ ...loose, songUuids: ['gone'] }, state)).toBeNull();
  });
});

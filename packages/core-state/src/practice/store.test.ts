import type { NewPracticeSession } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import { setup } from '../library/store.test-helper.ts';
import { PRACTICE_TEMPO_SAMPLE_MS } from './session.ts';
import {
  createPracticeSessionStore,
  type PracticePersistence,
} from './store.ts';

const MINUTE = 60_000;

function harness(engineBpm = () => 100) {
  const { library, metronome } = setup(engineBpm);
  let clock = 0;
  let uuids = 0;
  const ticks: (() => void)[] = [];
  const insert = vi.fn<PracticePersistence['insert']>(() => Promise.resolve());
  const practice = createPracticeSessionStore({
    metronome,
    library,
    persistence: { insert },
    now: () => clock,
    newUuid: () => `session-${String(++uuids)}`,
    every: (ms, tick) => {
      expect(ms).toBe(PRACTICE_TEMPO_SAMPLE_MS);
      ticks.push(tick);
      return () => {
        ticks.splice(ticks.indexOf(tick), 1);
      };
    },
  });
  const advance = (ms: number) => {
    const end = clock + ms;
    while (clock + PRACTICE_TEMPO_SAMPLE_MS <= end) {
      clock += PRACTICE_TEMPO_SAMPLE_MS;
      for (const tick of [...ticks]) tick();
    }
    clock = end;
  };
  return { library, metronome, practice, insert, advance, ticks };
}

async function onStage(h: ReturnType<typeof harness>) {
  const s = h.library.getState();
  const gig = await s.createSetlist('Gig');
  const first = await s.newSongFromCurrent('First', gig);
  const second = await s.newSongFromCurrent('Second', gig);
  const entries = h.library.getState().entries[gig] ?? [];
  const load = (index: number) => {
    const entry = entries[index];
    if (entry === undefined) throw new Error('missing entry');
    return h.library.getState().loadSong(entry.preset.id, entry.item.id, gig);
  };
  const uuidOf = (id: number) =>
    h.library.getState().presets.find((preset) => preset.id === id)?.uuid;
  return { gig, load, uuids: [uuidOf(first), uuidOf(second)] };
}

describe('practice session store', () => {
  it('starts on first play and survives a stop', () => {
    const h = harness();
    expect(h.practice.getState().session).toBeNull();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.metronome.getState().stop();
    h.advance(MINUTE);
    h.metronome.getState().start();
    h.advance(MINUTE);
    expect(h.practice.getState()).toMatchObject({
      session: { uuid: 'session-1' },
      pending: null,
    });
    expect(h.practice.getState().endSession()).toMatchObject({
      uuid: 'session-1',
      playedMs: 2 * MINUTE,
    });
  });

  it('produces exactly one pending summary per end', () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.metronome.getState().stop();
    const summary = h.practice.getState().endSession();
    expect(h.practice.getState()).toMatchObject({
      pending: summary,
      session: null,
    });
    expect(h.practice.getState().endSession()).toBeNull();
    expect(h.practice.getState().pending).toBe(summary);
  });

  it('keeps tracking in a new session when ended while still playing', () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.practice.getState().endSession();
    h.advance(MINUTE);
    expect(h.practice.getState().session?.uuid).toBe('session-2');
  });

  it('samples the ramp-effective tempo only while playing', () => {
    let engine = 100;
    const h = harness(() => engine);
    h.metronome.getState().setTempo(100);
    h.metronome.getState().start();
    expect(h.ticks).toHaveLength(1);
    h.advance(MINUTE);
    engine = 140;
    h.advance(MINUTE);
    h.metronome.getState().pause();
    expect(h.ticks).toHaveLength(0);
    expect(h.practice.getState().endSession()?.avgBpm).toBeCloseTo(
      (100 * 61 + 140 * 59) / 120,
      6,
    );
  });

  it('records the setlist and songs from the loaded set', async () => {
    const h = harness();
    const stage = await onStage(h);
    await stage.load(0);
    h.metronome.getState().start();
    h.advance(MINUTE);
    await stage.load(1);
    h.advance(3 * MINUTE);
    h.metronome.getState().stop();
    expect(h.practice.getState().endSession()).toMatchObject({
      setlist: { id: stage.gig, name: 'Gig' },
      songs: [
        { uuid: stage.uuids[0], title: 'First' },
        { uuid: stage.uuids[1], title: 'Second' },
      ],
      longestStretch: { ms: 3 * MINUTE, title: 'Second' },
    });
  });

  it('saves once however often save is called', async () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(90_000);
    h.metronome.getState().stop();
    h.practice.getState().endSession();
    await Promise.all([
      h.practice.getState().saveSession(),
      h.practice.getState().saveSession(),
    ]);
    await h.practice.getState().saveSession();
    expect(h.insert).toHaveBeenCalledTimes(1);
    expect(h.insert).toHaveBeenCalledWith({
      uuid: 'session-1',
      startedAt: new Date(0),
      durationSeconds: 90,
      avgBpm: 100,
      setlistId: null,
      songUuids: [],
    } satisfies NewPracticeSession);
    expect(h.practice.getState().pending).toBeNull();
  });

  it('keeps the summary after a failed save and retries the same uuid', async () => {
    const h = harness();
    h.insert.mockRejectedValueOnce(new Error('disk full'));
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.metronome.getState().stop();
    const summary = h.practice.getState().endSession();
    await expect(h.practice.getState().saveSession()).rejects.toThrow(
      'disk full',
    );
    expect(h.practice.getState().pending).toBe(summary);
    await h.practice.getState().saveSession();
    expect(h.insert.mock.calls.map(([record]) => record.uuid)).toEqual([
      summary?.uuid,
      summary?.uuid,
    ]);
    expect(h.practice.getState().pending).toBeNull();
  });

  it('discard writes nothing', async () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.metronome.getState().stop();
    h.practice.getState().endSession();
    h.practice.getState().discardSession();
    await h.practice.getState().saveSession();
    expect(h.practice.getState().pending).toBeNull();
    expect(h.insert).not.toHaveBeenCalled();
  });
});

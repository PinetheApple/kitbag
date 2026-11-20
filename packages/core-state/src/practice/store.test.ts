import { PRACTICE_LOG_VERSION, type NewPracticeSession } from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';

import { MIN_SAVED_PLAYED_MS } from './session.ts';
import { MINUTE } from './session.test-helper.ts';
import { harness, onStage } from './store.test-helper.ts';

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
      pending: [],
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
      pending: [summary],
      session: null,
    });
    expect(h.practice.getState().endSession()).toBeNull();
    expect(h.practice.getState().pending).toEqual([summary]);
  });

  it('keeps tracking in a new session when ended while still playing', () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    const first = h.practice.getState().endSession();
    h.advance(MINUTE);
    expect(h.practice.getState().session?.uuid).toBe('session-2');
    const second = h.practice.getState().endSession();
    expect(second).toMatchObject({ uuid: 'session-2', playedMs: MINUTE });
    expect(h.practice.getState().pending).toEqual([second, first]);
  });

  it('resolves queued summaries newest first', async () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    const first = h.practice.getState().endSession();
    h.advance(MINUTE);
    const second = h.practice.getState().endSession();
    h.advance(MINUTE);
    const third = h.practice.getState().endSession();
    expect(h.practice.getState().pending).toEqual([third, second, first]);
    await h.practice.getState().saveSession();
    expect(h.insert.mock.calls.map(([record]) => record.uuid)).toEqual([
      third?.uuid,
    ]);
    expect(h.practice.getState().pending).toEqual([second, first]);
    h.practice.getState().discardSession();
    expect(h.practice.getState().pending).toEqual([first]);
    await h.practice.getState().saveSession();
    expect(h.insert.mock.calls.map(([record]) => record.uuid)).toEqual([
      third?.uuid,
      first?.uuid,
    ]);
    expect(h.practice.getState().pending).toEqual([]);
  });

  it('puts a session ended during a save in front and saves it on its own', async () => {
    const h = harness();
    let finish: () => void = () => undefined;
    h.insert.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    h.metronome.getState().start();
    h.advance(MINUTE);
    const first = h.practice.getState().endSession();
    const firstSave = h.practice.getState().saveSession();
    await vi.waitFor(() => {
      expect(h.insert).toHaveBeenCalledTimes(1);
    });
    h.advance(MINUTE);
    const second = h.practice.getState().endSession();
    expect(h.practice.getState().pending).toEqual([second, first]);
    const secondSave = h.practice.getState().saveSession();
    expect(secondSave).not.toBe(firstSave);
    await secondSave;
    expect(h.practice.getState().pending).toEqual([first]);
    finish();
    await firstSave;
    expect(h.insert.mock.calls.map(([record]) => record.uuid)).toEqual([
      first?.uuid,
      second?.uuid,
    ]);
    expect(h.practice.getState().pending).toEqual([]);
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
    h.metronome.getState().setTempo(100);
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
      setlistName: null,
      songUuids: [],
      log: {
        v: PRACTICE_LOG_VERSION,
        stretches: [expect.objectContaining({ from: 0, to: 90_000 })],
      },
    } satisfies NewPracticeSession);
    expect(h.practice.getState().pending).toEqual([]);
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
    expect(h.practice.getState().pending).toEqual([summary]);
    await h.practice.getState().saveSession();
    expect(h.insert.mock.calls.map(([record]) => record.uuid)).toEqual([
      summary?.uuid,
      summary?.uuid,
    ]);
    expect(h.practice.getState().pending).toEqual([]);
  });

  it('lets a discard during a failing save drop the summary', async () => {
    const h = harness();
    let fail: (error: Error) => void = () => undefined;
    h.insert.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.metronome.getState().stop();
    h.practice.getState().endSession();
    const save = h.practice.getState().saveSession();
    await vi.waitFor(() => {
      expect(h.insert).toHaveBeenCalledTimes(1);
    });
    h.practice.getState().discardSession();
    fail(new Error('disk full'));
    await save.catch(() => undefined);
    expect(h.practice.getState().pending).toEqual([]);
    await h.practice.getState().saveSession();
    expect(h.insert).toHaveBeenCalledTimes(1);
  });

  it('ends a session under one whole second with nothing to save', () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MIN_SAVED_PLAYED_MS - 1);
    h.metronome.getState().stop();
    expect(h.practice.getState().endSession()).toBeNull();
    expect(h.practice.getState()).toMatchObject({
      session: null,
      pending: [],
    });
  });

  it('keeps a session of exactly one second', () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MIN_SAVED_PLAYED_MS);
    h.metronome.getState().stop();
    expect(h.practice.getState().endSession()?.playedMs).toBe(
      MIN_SAVED_PLAYED_MS,
    );
  });

  it('reads the tempo once when it ends a session', () => {
    const engineBpm = vi.fn(() => 100);
    const h = harness(engineBpm);
    h.metronome.getState().start();
    h.advance(MINUTE);
    engineBpm.mockClear();
    h.practice.getState().endSession();
    expect(engineBpm).toHaveBeenCalledTimes(1);
  });

  it('discard writes nothing', async () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.metronome.getState().stop();
    h.practice.getState().endSession();
    h.practice.getState().discardSession();
    await h.practice.getState().saveSession();
    expect(h.practice.getState().pending).toEqual([]);
    expect(h.insert).not.toHaveBeenCalled();
  });
});

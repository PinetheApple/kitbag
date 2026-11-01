import { describe, expect, it } from 'vitest';

import {
  endPracticeSession,
  practiceSessionAfterContext,
  practiceSessionAfterRunning,
  practiceSessionAfterTempo,
  startPracticeSession,
  type PracticeContext,
  type PracticeSession,
} from './session.ts';

const MINUTE = 60_000;
const FRIDAY = { id: 7, name: 'Friday' };
const OPENER = { uuid: 'opener', title: 'Opener' };
const CLOSER = { uuid: 'closer', title: 'Closer' };
const NOTHING: PracticeContext = { setlist: null, song: null };

function onStage(song: PracticeContext['song']): PracticeContext {
  return { setlist: FRIDAY, song };
}

function paused(session: PracticeSession, at: number) {
  return practiceSessionAfterRunning(session, false, at, 0);
}

function resumed(session: PracticeSession, at: number, bpm: number) {
  return practiceSessionAfterRunning(session, true, at, bpm);
}

describe('practice session', () => {
  it('counts playing time only, across pauses, until it ends', () => {
    let session = startPracticeSession('s', 0, 100, NOTHING);
    session = paused(session, 5 * MINUTE);
    session = resumed(session, 30 * MINUTE, 100);
    const summary = endPracticeSession(session, 33 * MINUTE, 100);
    expect(summary).toMatchObject({
      uuid: 's',
      startedAt: 0,
      playedMs: 8 * MINUTE,
    });
  });

  it('a pause produces no summary and keeps the session', () => {
    const session = paused(startPracticeSession('s', 0, 100, NOTHING), MINUTE);
    expect(session).toMatchObject({ uuid: 's', startedAt: 0 });
    expect(resumed(session, 2 * MINUTE, 100).uuid).toBe('s');
  });

  it('records the setlist and each song once, in first-played order', () => {
    let session = startPracticeSession('s', 0, 100, onStage(OPENER));
    session = practiceSessionAfterContext(session, onStage(CLOSER), MINUTE);
    session = practiceSessionAfterContext(session, onStage(OPENER), 2 * MINUTE);
    const summary = endPracticeSession(session, 3 * MINUTE, 100);
    expect(summary.setlist).toEqual(FRIDAY);
    expect(summary.songs).toEqual([OPENER, CLOSER]);
  });

  it('does not count a song loaded and left while paused', () => {
    let session = paused(
      startPracticeSession('s', 0, 100, onStage(OPENER)),
      MINUTE,
    );
    session = practiceSessionAfterContext(session, onStage(CLOSER), 2 * MINUTE);
    session = practiceSessionAfterContext(session, onStage(OPENER), 3 * MINUTE);
    session = resumed(session, 4 * MINUTE, 100);
    expect(endPracticeSession(session, 5 * MINUTE, 100).songs).toEqual([
      OPENER,
    ]);
  });

  it('takes the first setlist played in, even if one starts later', () => {
    let session = startPracticeSession('s', 0, 100, NOTHING);
    session = practiceSessionAfterContext(session, onStage(OPENER), MINUTE);
    session = practiceSessionAfterContext(
      session,
      { setlist: { id: 9, name: 'Acoustic' }, song: OPENER },
      2 * MINUTE,
    );
    expect(endPracticeSession(session, 3 * MINUTE, 100).setlist).toEqual(
      FRIDAY,
    );
  });

  it('splits the longest stretch at a pause and at a song change', () => {
    let session = startPracticeSession('s', 0, 100, onStage(OPENER));
    session = practiceSessionAfterContext(session, onStage(CLOSER), 4 * MINUTE);
    session = paused(session, 10 * MINUTE);
    session = resumed(session, 11 * MINUTE, 100);
    const summary = endPracticeSession(session, 16 * MINUTE, 100);
    expect(summary.playedMs).toBe(15 * MINUTE);
    expect(summary.longestStretch).toEqual({ ms: 6 * MINUTE, title: 'Closer' });
  });

  it('names no song for a stretch played without one', () => {
    let session = startPracticeSession('s', 0, 100, NOTHING);
    session = practiceSessionAfterContext(session, onStage(OPENER), 3 * MINUTE);
    const summary = endPracticeSession(session, 4 * MINUTE, 100);
    expect(summary.longestStretch).toEqual({ ms: 3 * MINUTE, title: null });
  });

  it('keeps the earlier stretch on a tie', () => {
    let session = startPracticeSession('s', 0, 100, onStage(OPENER));
    session = practiceSessionAfterContext(session, onStage(CLOSER), 2 * MINUTE);
    const summary = endPracticeSession(session, 4 * MINUTE, 100);
    expect(summary.longestStretch).toEqual({ ms: 2 * MINUTE, title: 'Opener' });
  });

  it('weights the average tempo by playing time, ignoring paused time', () => {
    let session = startPracticeSession('s', 0, 80, NOTHING);
    session = practiceSessionAfterTempo(session, 3 * MINUTE, 120);
    session = paused(session, 4 * MINUTE);
    session = resumed(session, 60 * MINUTE, 120);
    expect(
      endPracticeSession(session, 60 * MINUTE + 1, 120).avgBpm,
    ).toBeCloseTo((80 * 3 + 120 * 1) / 4, 3);
  });

  it('averages a ramp from its sampled tempo', () => {
    let session = startPracticeSession('s', 0, 100, NOTHING);
    for (let second = 1; second <= 10; second++)
      session = practiceSessionAfterTempo(session, second * 1000, 100 + second);
    const summary = endPracticeSession(session, 11_000, 111);
    expect(summary.avgBpm).toBeCloseTo(
      (100 + 101 + 102 + 103 + 104 + 105 + 106 + 107 + 108 + 109 + 110) / 11,
      6,
    );
  });

  it('reports the starting tempo for a session with no playing time', () => {
    const session = startPracticeSession('s', 0, 96, NOTHING);
    expect(endPracticeSession(session, 0, 96)).toMatchObject({
      playedMs: 0,
      avgBpm: 96,
      longestStretch: { ms: 0, title: null },
    });
  });
});

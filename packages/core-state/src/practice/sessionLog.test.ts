import { STRETCH_END } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import {
  endPracticeSession,
  practiceSessionAfterContext,
  practiceSessionAfterPause,
  practiceSessionAfterPlay,
  practiceSessionAfterSettings,
  practiceSessionAfterTempo,
  practiceSessionAfterTempoChange,
  startPracticeSession,
  type PracticeContext,
  type PracticeSession,
} from './session.ts';
import {
  CLOSER,
  MINUTE,
  NOTHING,
  onStage,
  OPENER,
  SECOND,
  SETUP,
  setupWith,
} from './session.test-helper.ts';
import { STRETCH_FOLD_MS, TEMPO_SETTLE_MS } from './stretch.ts';

const WALTZ = setupWith({ beatsPerBar: 3 });
const RAMP = setupWith({
  rampEnabled: true,
  rampStartBpm: 100,
  rampEndBpm: 124,
});

function moved(session: PracticeSession, context: PracticeContext, at: number) {
  return practiceSessionAfterContext(session, context, at, 100, SETUP);
}

function tempoAt(session: PracticeSession, at: number, bpm: number) {
  return practiceSessionAfterTempoChange(session, at, bpm, SETUP);
}

const logOf = (session: PracticeSession, at: number, bpm = 100) =>
  endPracticeSession(session, at, bpm).log.stretches;

describe('practice session log', () => {
  it('opens and closes a stretch at play, pause, song, settings and end', () => {
    let session = startPracticeSession('s', 0, 100, onStage(OPENER), SETUP);
    session = practiceSessionAfterPause(session, 2 * MINUTE, 100);
    session = practiceSessionAfterPlay(session, 3 * MINUTE, 100, SETUP);
    session = moved(session, onStage(CLOSER), 4 * MINUTE);
    session = practiceSessionAfterSettings(session, 5 * MINUTE, 100, WALTZ);
    expect(logOf(session, 6 * MINUTE)).toMatchObject([
      { from: 0, to: 2 * MINUTE, end: STRETCH_END.pause, song: OPENER },
      { from: 3 * MINUTE, to: 4 * MINUTE, end: STRETCH_END.song, song: OPENER },
      {
        from: 4 * MINUTE,
        to: 5 * MINUTE,
        end: STRETCH_END.settings,
        song: CLOSER,
        setlist: { uuid: 'friday', name: 'Friday', position: 2 },
        settings: { beatsPerBar: SETUP.settings.beatsPerBar },
      },
      {
        from: 5 * MINUTE,
        to: 6 * MINUTE,
        end: STRETCH_END.end,
        settings: { beatsPerBar: 3 },
      },
    ]);
  });

  it('logs a burst of tempo changes once it settles', () => {
    let session = startPracticeSession('s', 0, 100, NOTHING, SETUP);
    const burst = MINUTE;
    for (let step = 0; step < 10; step++)
      session = tempoAt(session, burst + step * 100, 101 + step);
    session = tempoAt(session, 3 * MINUTE, 90);
    const [stretch] = logOf(session, 4 * MINUTE, 90);
    expect(stretch?.tempo).toEqual([
      [burst, 110],
      [3 * MINUTE, 90],
    ]);
  });

  it('keeps changes further apart than the settle time apart', () => {
    let session = startPracticeSession('s', 0, 100, NOTHING, SETUP);
    session = tempoAt(session, MINUTE, 104);
    session = tempoAt(session, MINUTE + TEMPO_SETTLE_MS, 108);
    expect(logOf(session, 2 * MINUTE)[0]?.tempo).toEqual([
      [MINUTE, 104],
      [MINUTE + TEMPO_SETTLE_MS, 108],
    ]);
  });

  it('logs nothing for a burst that comes back to where it started', () => {
    let session = startPracticeSession('s', 0, 100, NOTHING, SETUP);
    session = tempoAt(session, MINUTE, 104);
    session = tempoAt(session, MINUTE + SECOND, 100);
    expect(logOf(session, 2 * MINUTE)[0]?.tempo).toEqual([]);
  });

  it('logs a ramp as its settings and where it ended, not its steps', () => {
    let session = startPracticeSession('s', 0, 100, NOTHING, RAMP);
    for (let second = 1; second <= 60; second++)
      session = practiceSessionAfterTempo(
        session,
        second * SECOND,
        100 + second / 5,
      );
    expect(logOf(session, MINUTE, 112)).toMatchObject([
      {
        settings: { rampEnabled: true, rampStartBpm: 100, rampEndBpm: 124 },
        tempo: [],
        endBpm: 112,
      },
    ]);
  });

  it('folds changes made as a stretch opens into it, dropping empty stretches', () => {
    let session = startPracticeSession('s', 0, 100, onStage(OPENER), SETUP);
    const load = 2 * MINUTE;
    session = practiceSessionAfterSettings(session, load, 96, WALTZ);
    session = practiceSessionAfterSettings(session, load, 96, RAMP);
    session = practiceSessionAfterContext(
      session,
      onStage(CLOSER),
      load + 1,
      96,
      RAMP,
    );
    session = practiceSessionAfterTempoChange(session, load + 2, 98, RAMP);
    const log = logOf(session, 3 * MINUTE, 98);
    expect(log).toMatchObject([
      { from: 0, to: load, end: STRETCH_END.song, song: OPENER },
      {
        from: load,
        end: STRETCH_END.end,
        song: CLOSER,
        settings: { rampEnabled: true },
        tempo: [],
      },
    ]);
    expect(
      log.every((stretch) => stretch.to - stretch.from >= STRETCH_FOLD_MS),
    ).toBe(true);
  });

  it('logs a stem song by its key and title with no metronome settings', () => {
    const stem = { stemSongKey: 'stemdeck:job-1', title: 'Redbone' };
    let session = startPracticeSession('s', 0, 100, onStage(OPENER), SETUP);
    session = moved(session, { ...onStage(null, 3), song: stem }, MINUTE);
    const summary = endPracticeSession(session, 2 * MINUTE, 100);
    expect(summary.log.stretches[1]).toMatchObject({
      song: stem,
      setlist: { position: 3 },
      settings: null,
      countIn: null,
    });
    expect(summary.songs).toEqual([OPENER]);
  });

  it('records the starting count-in and the tempo each stretch ended on', () => {
    const countIn = {
      ...SETUP,
      countIn: { bars: 1, distinct: true, sound: 2 },
    };
    let session = startPracticeSession('s', 0, 100, NOTHING, countIn);
    session = tempoAt(session, MINUTE, 120);
    expect(logOf(session, 2 * MINUTE, 120)).toMatchObject([
      {
        countIn: { bars: 1, distinct: true, sound: 2 },
        endBpm: 120,
        avgBpm: 110,
      },
    ]);
  });
});

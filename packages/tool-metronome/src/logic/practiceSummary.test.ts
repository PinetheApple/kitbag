import {
  createLibraryStore,
  createMetronomeStore,
  createPracticeSessionStore,
  practiceElapsedMs,
  type MetronomeCommands,
  type PracticePersistence,
  type PracticeSummary,
} from '@kitbag/core-state';
import { describe, expect, it, vi } from 'vitest';

import {
  averageTempoLabel,
  longestStretchLabel,
  practiceContextLine,
  summarySheetOnMount,
} from './practiceSummary.ts';
import { endPractice } from './practiceTimer.ts';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

const noCommands = new Proxy(
  {},
  { get: () => () => Promise.resolve(0) },
) as MetronomeCommands;

function harness() {
  let clock = 0;
  let uuids = 0;
  const now = () => clock;
  const metronome = createMetronomeStore(
    noCommands,
    () => 0,
    () => 100,
    now,
  );
  const library = createLibraryStore({
    repos: () => {
      throw new Error('no repositories in this test');
    },
    metronome: () => metronome.getState(),
    now,
  });
  const insert = vi.fn<PracticePersistence['insert']>(() => Promise.resolve());
  const sessions = createPracticeSessionStore({
    metronome,
    library,
    persistence: { insert },
    now,
    newUuid: () => `session-${String(++uuids)}`,
    every: () => () => undefined,
  });
  const advance = (ms: number) => {
    clock += ms;
  };
  const pill = () => practiceElapsedMs(metronome.getState().practice, clock);
  const end = () => {
    endPractice(sessions, metronome.getState().resetPractice);
  };
  return { metronome, sessions, insert, advance, pill, end };
}

function summary(overrides: Partial<PracticeSummary> = {}): PracticeSummary {
  return {
    uuid: 'session-1',
    startedAt: 0,
    playedMs: 42 * MINUTE,
    setlist: { id: 1, name: 'Wedding set' },
    songs: [
      { uuid: 'a', title: 'Blackbird' },
      { uuid: 'b', title: 'Wonderwall' },
    ],
    avgBpm: 117.6,
    longestStretch: { ms: 11 * MINUTE + 2 * SECOND, title: 'Blackbird' },
    ...overrides,
  };
}

describe('ending a practice session', () => {
  it('ends on the pill, holds the summary and zeros the pill', () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(2 * MINUTE);
    h.metronome.getState().stop();
    const shown = h.pill();
    h.end();
    expect(h.sessions.getState().pending?.playedMs).toBe(shown);
    expect(h.pill()).toBe(0);
  });

  it('only pauses on the transport stop', () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.metronome.getState().stop();
    expect(h.sessions.getState().pending).toBeNull();
    expect(h.sessions.getState().session).not.toBeNull();
    expect(h.pill()).toBe(MINUTE);
  });

  it('leaves a summary pending when the screen goes while playing', () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.end();
    expect(h.sessions.getState().pending?.playedMs).toBe(MINUTE);
    expect(summarySheetOnMount(h.sessions.getState().pending)).toBe('summary');
    h.advance(SECOND);
    expect(h.pill()).toBe(SECOND);
  });

  it('leaves the newer session and the pill alone while a summary is pending', () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.end();
    const first = h.sessions.getState().pending;
    h.advance(MINUTE);
    h.end();
    expect(h.sessions.getState().pending).toBe(first);
    expect(h.pill()).toBe(MINUTE);
  });

  it('saves once however often Save is pressed', async () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.end();
    await Promise.all([
      h.sessions.getState().saveSession(),
      h.sessions.getState().saveSession(),
    ]);
    await h.sessions.getState().saveSession();
    expect(h.insert).toHaveBeenCalledTimes(1);
    expect(h.sessions.getState().pending).toBeNull();
  });

  it('writes nothing on discard', async () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.end();
    h.sessions.getState().discardSession();
    await h.sessions.getState().saveSession();
    expect(h.insert).not.toHaveBeenCalled();
    expect(h.sessions.getState().pending).toBeNull();
  });
});

describe('summarySheetOnMount', () => {
  it('reopens a summary that was dismissed rather than resolved', () => {
    expect(summarySheetOnMount(summary())).toBe('summary');
  });

  it('opens nothing with no summary pending', () => {
    expect(summarySheetOnMount(null)).toBe('none');
  });
});

describe('practiceContextLine', () => {
  it('names the set and counts its songs', () => {
    expect(practiceContextLine(summary())).toBe('Wedding set · 2 songs');
  });

  it('counts a single song in the singular', () => {
    expect(
      practiceContextLine(
        summary({ songs: [{ uuid: 'a', title: 'Blackbird' }] }),
      ),
    ).toBe('Wedding set · 1 song');
  });

  it('drops the half it has nothing for', () => {
    expect(practiceContextLine(summary({ setlist: null }))).toBe('2 songs');
    expect(practiceContextLine(summary({ songs: [] }))).toBe('Wedding set');
  });

  it('has no line for a free practice', () => {
    expect(practiceContextLine(summary({ setlist: null, songs: [] }))).toBe(
      null,
    );
  });
});

describe('averageTempoLabel', () => {
  it('rounds to a whole BPM', () => {
    expect(averageTempoLabel(117.6)).toBe('118 BPM');
  });
});

describe('longestStretchLabel', () => {
  it('names the song it was played on', () => {
    expect(
      longestStretchLabel({ ms: 11 * MINUTE + 2 * SECOND, title: 'Blackbird' }),
    ).toBe('Blackbird · 11:02');
  });

  it('is just the time when no song was loaded', () => {
    expect(longestStretchLabel({ ms: 90 * SECOND, title: null })).toBe('1:30');
  });

  it('has no row without a stretch', () => {
    expect(longestStretchLabel(null)).toBe(null);
  });
});

import type { PracticeSummary } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  averageTempoLabel,
  longestStretchLabel,
  practiceContextLine,
  summaryButtons,
  summarySheetOnMount,
} from './practiceSummary.ts';
import {
  MINUTE,
  practiceHarness as harness,
  SECOND,
} from './practiceSessions.test-helper.ts';

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
    expect(h.sessions.getState().pending[0]?.playedMs).toBe(shown);
    expect(h.pill()).toBe(0);
  });

  it('only pauses on the transport stop', () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.metronome.getState().stop();
    expect(h.sessions.getState().pending).toEqual([]);
    expect(h.sessions.getState().session).not.toBeNull();
    expect(h.pill()).toBe(MINUTE);
  });

  it('leaves a summary pending when the screen goes while playing', () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.end();
    expect(h.sessions.getState().pending[0]?.playedMs).toBe(MINUTE);
    expect(summarySheetOnMount(h.sessions.getState().pending)).toBe('summary');
    h.advance(SECOND);
    expect(h.pill()).toBe(SECOND);
  });

  it('shows the session just ended ahead of one still pending and zeros the pill', () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.end();
    h.advance(2 * MINUTE);
    h.end();
    expect(h.sessions.getState().pending.map((s) => s.playedMs)).toEqual([
      2 * MINUTE,
      MINUTE,
    ]);
    expect(h.pill()).toBe(0);
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
    expect(h.sessions.getState().pending).toEqual([]);
  });

  it('writes nothing on discard', async () => {
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.end();
    h.sessions.getState().discardSession();
    await h.sessions.getState().saveSession();
    expect(h.insert).not.toHaveBeenCalled();
    expect(h.sessions.getState().pending).toEqual([]);
  });
});

describe('summaryButtons', () => {
  it('offers both choices before a save', () => {
    expect(summaryButtons('idle')).toEqual({
      saveLabel: 'Save session',
      saveDisabled: false,
      discardDisabled: false,
    });
  });

  it('holds Discard while a save is in flight so it cannot race the write', () => {
    expect(summaryButtons('saving')).toMatchObject({
      saveDisabled: true,
      discardDisabled: true,
    });
  });

  it('offers a retry or a discard after a failed save', () => {
    expect(summaryButtons('failed')).toEqual({
      saveLabel: 'Try again',
      saveDisabled: false,
      discardDisabled: false,
    });
  });
});

describe('summarySheetOnMount', () => {
  it('reopens a summary that was dismissed rather than resolved', () => {
    expect(summarySheetOnMount([summary()])).toBe('summary');
  });

  it('opens nothing with no summary pending', () => {
    expect(summarySheetOnMount([])).toBe('none');
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

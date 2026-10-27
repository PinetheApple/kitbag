import { describe, expect, it } from 'vitest';

import {
  metronomeResumeSubtitle,
  metronomeTileSubtext,
  songsTileSubtext,
  stemsTileSubtext,
  type MetronomeSummary,
} from './subtext.ts';

const base: MetronomeSummary = {
  bpm: 124,
  beatsPerBar: 7,
  denominator: 8,
  running: false,
  ramp: { enabled: false, startBpm: 80, targetBpm: 120 },
};

describe('metronome subtext', () => {
  it('shows the stored tempo while stopped', () => {
    expect(metronomeTileSubtext(base)).toBe('124 BPM ready');
    expect(metronomeResumeSubtitle(base)).toBe('124 BPM · 7/8');
  });

  it('says when the click is sounding', () => {
    const running = { ...base, running: true };
    expect(metronomeTileSubtext(running)).toBe('124 BPM playing');
    expect(metronomeResumeSubtitle(running)).toBe('124 BPM · 7/8 · playing');
  });

  it('shows the ramp range instead of a tempo the engine is not playing', () => {
    const ramp = {
      ...base,
      running: true,
      ramp: { ...base.ramp, enabled: true },
    };
    expect(metronomeTileSubtext(ramp)).toBe('Ramp 80→120 BPM playing');
    expect(metronomeResumeSubtitle(ramp)).not.toContain('124');
  });
});

describe('library subtext', () => {
  it('counts songs, finished analyses and stem songs', () => {
    const summary = { songCount: 12, analyzedCount: 9, stemSongCount: 3 };
    expect(songsTileSubtext(summary)).toBe('12 songs · 9 analyzed');
    expect(stemsTileSubtext(summary)).toBe('3 stem songs');
  });

  it('reads naturally for one and for none', () => {
    const one = { songCount: 1, analyzedCount: 0, stemSongCount: 1 };
    expect(songsTileSubtext(one)).toBe('1 song · 0 analyzed');
    expect(stemsTileSubtext(one)).toBe('1 stem song');
    expect(
      stemsTileSubtext({ songCount: 0, analyzedCount: 0, stemSongCount: 0 }),
    ).toBe('0 stem songs');
  });
});

import { describe, expect, it } from 'vitest';

import {
  metronomeResumeSubtitle,
  metronomeTileSubtext,
  type MetronomeSummary,
} from './subtext.ts';

const base: MetronomeSummary = {
  bpm: 124,
  beatsPerBar: 7,
  denominator: 8,
  running: false,
  ramp: { enabled: false, startBpm: 80, endBpm: 120 },
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

import type { ExportSummary } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  exportBlockReason,
  exportRowValue,
  formatLabel,
  keyLabel,
  rangeLabel,
  runningBody,
  sizeLabel,
  speedLabel,
  stemsLabel,
} from './exportView.ts';

const SUMMARY: ExportSummary = {
  speed: 1,
  key: 0,
  stems: 6,
  muted: 0,
  soloed: 0,
  loopSet: false,
  lengthSec: 252,
  sampleRate: 48_000,
  bytes: 48_384_044,
  fileName: 'Song.wav',
};

describe('exportRowValue', () => {
  it('names the format when export is open', () => {
    expect(exportRowValue(null, 0)).toBe('WAV');
  });

  it('gives the reason when it is not', () => {
    expect(exportRowValue('running', 42)).toBe('exporting, 42%');
    expect(exportRowValue('noStems', 0)).toBe('no stems to mix');
    expect(exportRowValue('allMuted', 0)).toBe('every stem muted');
    expect(exportRowValue('soloMuted', 0)).toBe('soloed stems muted');
  });

  it('words each blocked reason on its own', () => {
    expect(exportBlockReason('noStems')).toBe('no stems to mix');
    expect(exportBlockReason('allMuted')).toBe('every stem muted');
    expect(exportBlockReason('soloMuted')).toBe('soloed stems muted');
  });
});

describe('confirm sheet values', () => {
  it('writes speed with at least one decimal', () => {
    expect(speedLabel(1)).toBe('1.0×');
    expect(speedLabel(0.75)).toBe('0.75×');
  });

  it('writes the key as a shift from the recording', () => {
    expect(keyLabel(0)).toBe('As recorded');
    expect(keyLabel(-2)).toBe('−2 semitones');
    expect(keyLabel(1)).toBe('+1 semitone');
    expect(keyLabel(null)).toBe('Set per stem');
  });

  it('counts the stems with solo before mute', () => {
    expect(stemsLabel(SUMMARY)).toBe('6');
    expect(stemsLabel({ ...SUMMARY, muted: 2 })).toBe('6 · 2 muted');
    expect(stemsLabel({ ...SUMMARY, muted: 2, soloed: 1 })).toBe(
      '6 · 1 soloed',
    );
  });

  it('says a loop is left out', () => {
    expect(rangeLabel(false)).toBe('Whole song');
    expect(rangeLabel(true)).toBe('Whole song · loop not used');
  });

  it('states the format and the estimated size', () => {
    expect(formatLabel(48_000)).toBe('WAV · 16-bit · 48 kHz');
    expect(formatLabel(44_100)).toBe('WAV · 16-bit · 44.1 kHz');
    expect(sizeLabel(SUMMARY.bytes)).toBe('about 48.4 MB');
  });
});

describe('runningBody', () => {
  it('names the song only when another one is open', () => {
    expect(runningBody(null)).toBe(
      'Keep playing if you like; this does not change the file. The share sheet opens when it is done.',
    );
    expect(runningBody('Echo')).toBe(
      'Exporting “Echo”. The share sheet opens when it is done.',
    );
  });
});

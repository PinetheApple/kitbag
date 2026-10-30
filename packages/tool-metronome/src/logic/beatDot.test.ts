import { KB_ACCENT } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { beatLabel, beatMarker, dotLook, ledStateFor } from './beatDot.ts';

const PALETTE = {
  accent: 'accent',
  fill: 'surface3',
  border: 'dotBorder',
  hollow: 'text3',
  silentNow: 'text',
  clear: 'transparent',
};
const WIDTHS = { normal: 2, accent: 5, silentNow: 4 };

describe('dotLook', () => {
  it('tells the three states apart by shape at rest', () => {
    expect(dotLook('accented', false, false, PALETTE, WIDTHS)).toEqual({
      backgroundColor: 'transparent',
      borderColor: 'accent',
      borderWidth: 5,
    });
    expect(dotLook('normal', false, false, PALETTE, WIDTHS)).toEqual({
      backgroundColor: 'surface3',
      borderColor: 'dotBorder',
      borderWidth: 2,
    });
    expect(dotLook('muted', false, false, PALETTE, WIDTHS)).toEqual({
      backgroundColor: 'transparent',
      borderColor: 'text3',
      borderWidth: 2,
    });
  });

  it('fills the sounding dot and keeps the accent ring width', () => {
    expect(dotLook('normal', true, false, PALETTE, WIDTHS)).toEqual({
      backgroundColor: 'accent',
      borderColor: 'accent',
      borderWidth: 2,
    });
    expect(dotLook('accented', true, false, PALETTE, WIDTHS).borderWidth).toBe(
      5,
    );
  });

  it('keeps a muted beat hollow when current, outlining it in text', () => {
    expect(dotLook('muted', true, false, PALETTE, WIDTHS)).toEqual({
      backgroundColor: 'transparent',
      borderColor: 'text',
      borderWidth: 2,
    });
  });

  it('hollows every dot in a muted bar, the sounding one thickest', () => {
    for (const state of ['accented', 'normal', 'muted'] as const) {
      expect(dotLook(state, false, true, PALETTE, WIDTHS)).toEqual({
        backgroundColor: 'transparent',
        borderColor: 'text3',
        borderWidth: 2,
      });
      expect(dotLook(state, true, true, PALETTE, WIDTHS)).toEqual({
        backgroundColor: 'transparent',
        borderColor: 'text',
        borderWidth: 4,
      });
    }
  });
});

describe('beat labels', () => {
  it('names the beat from one and its accent state', () => {
    expect(beatLabel(0, ledStateFor(KB_ACCENT.KB_ACCENT_ACCENTED))).toBe(
      'Beat 1, accented',
    );
    expect(beatLabel(3, ledStateFor(KB_ACCENT.KB_ACCENT_MUTED))).toBe(
      'Beat 4, muted',
    );
  });
});

describe('beatMarker', () => {
  it('labels only the downbeat', () => {
    expect(beatMarker(0)).toBe('1');
    expect(beatMarker(1).trim()).toBe('');
  });

  it('gives every beat text to measure, so no marker keeps an old text scale', () => {
    for (let beat = 0; beat < 12; beat++) {
      expect(beatMarker(beat)).not.toBe('');
    }
  });
});

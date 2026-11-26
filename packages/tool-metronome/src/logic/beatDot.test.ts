import { TEXT_PLACEHOLDER } from '@kitbag/core-design';
import { KB_ACCENT } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { beatLabel, beatMarker, dotLook, ledStateFor } from './beatDot.ts';

const PALETTE = {
  accent: 'accent',
  fill: 'surface3',
  border: 'dotBorder',
  hollow: 'decor',
  silentNow: 'text',
  clear: 'transparent',
};

describe('dotLook', () => {
  it('tells the three states apart by shape at rest', () => {
    expect(dotLook('accented', false, false, PALETTE)).toEqual({
      fill: 'transparent',
      edge: 'accent',
      accentEdge: 'accent',
      silentNowEdge: 'transparent',
    });
    expect(dotLook('normal', false, false, PALETTE)).toEqual({
      fill: 'surface3',
      edge: 'dotBorder',
      accentEdge: 'transparent',
      silentNowEdge: 'transparent',
    });
    expect(dotLook('muted', false, false, PALETTE)).toEqual({
      fill: 'transparent',
      edge: 'decor',
      accentEdge: 'transparent',
      silentNowEdge: 'transparent',
    });
  });

  it('fills the sounding dot and keeps the accent ring width', () => {
    expect(dotLook('normal', true, false, PALETTE)).toEqual({
      fill: 'accent',
      edge: 'accent',
      accentEdge: 'transparent',
      silentNowEdge: 'transparent',
    });
    expect(dotLook('accented', true, false, PALETTE).accentEdge).toBe('accent');
  });

  it('keeps a muted beat hollow when current, outlining it in text', () => {
    expect(dotLook('muted', true, false, PALETTE)).toEqual({
      fill: 'transparent',
      edge: 'text',
      accentEdge: 'transparent',
      silentNowEdge: 'transparent',
    });
  });

  it('hollows every dot in a muted bar, the sounding one thickest', () => {
    for (const state of ['accented', 'normal', 'muted'] as const) {
      expect(dotLook(state, false, true, PALETTE)).toEqual({
        fill: 'transparent',
        edge: 'decor',
        accentEdge: 'transparent',
        silentNowEdge: 'transparent',
      });
      expect(dotLook(state, true, true, PALETTE)).toEqual({
        fill: 'transparent',
        edge: 'transparent',
        accentEdge: 'transparent',
        silentNowEdge: 'text',
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
    expect(beatMarker(1)).toBe(TEXT_PLACEHOLDER);
  });

  it('gives every beat text to measure, so no marker keeps an old text scale', () => {
    expect(TEXT_PLACEHOLDER).toBe('\u00A0');
  });
});

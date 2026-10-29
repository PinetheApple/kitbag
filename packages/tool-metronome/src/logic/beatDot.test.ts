import { KB_ACCENT } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { beatLabel, dotLook, ledStateFor } from './beatDot.ts';

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

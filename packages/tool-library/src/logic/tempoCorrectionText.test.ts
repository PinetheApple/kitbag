import { TEMPO_CORRECTION } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  detectedTempoHint,
  tempoCorrectionOptions,
  tempoCorrectionValue,
  tempoSetText,
} from './tempoCorrectionText.ts';

const DETECTED = 104;

describe('tempo correction text', () => {
  it('lists the options slowest to fastest with their tempo', () => {
    expect(tempoCorrectionOptions(DETECTED)).toEqual([
      {
        value: 'half',
        label: '÷2',
        detail: '52',
        accessibilityLabel: 'Half, 52 BPM',
      },
      {
        value: 'twoThirds',
        label: '×2/3',
        detail: '69',
        accessibilityLabel: 'Two thirds, 69 BPM',
      },
      {
        value: 'none',
        label: '×1',
        detail: '104',
        accessibilityLabel: 'As detected, 104 BPM',
      },
      {
        value: 'threeHalves',
        label: '×3/2',
        detail: '156',
        accessibilityLabel: 'One and a half times, 156 BPM',
      },
      {
        value: 'double',
        label: '×2',
        detail: '208',
        accessibilityLabel: 'Double, 208 BPM',
      },
    ]);
  });

  it.each([
    [TEMPO_CORRECTION.none, '×1 · 104 BPM', 'as detected, 104 BPM'],
    [
      TEMPO_CORRECTION.threeHalves,
      '×3/2 · 156 BPM',
      'one and a half times, 156 BPM',
    ],
  ])('shows the %s row value and speaks it in words', (c, shown, spoken) => {
    expect(tempoCorrectionValue(c, DETECTED)).toEqual({ shown, spoken });
  });

  it('shows only the factor without a tempo', () => {
    expect(tempoCorrectionValue(TEMPO_CORRECTION.double, null)).toEqual({
      shown: '×2',
      spoken: 'double',
    });
  });

  it('always says the detected tempo', () => {
    expect(detectedTempoHint(DETECTED)).toBe('Detected: 104 BPM');
  });

  it('notes a pick, and ×1 as back to the detected tempo', () => {
    expect(tempoSetText(TEMPO_CORRECTION.threeHalves, DETECTED)).toEqual({
      shown: 'Tempo set to ×3/2 · 156 BPM. Saved for this song.',
      spoken:
        'Tempo set to one and a half times, 156 BPM. Saved for this song.',
    });
    expect(tempoSetText(TEMPO_CORRECTION.none, DETECTED).shown).toBe(
      'Back to the detected tempo. Saved for this song.',
    );
  });
});

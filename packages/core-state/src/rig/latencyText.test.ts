import { describe, expect, it } from 'vitest';

import { MINUS } from '../text.ts';
import { formatOffsetMs } from './latencyText.ts';

describe('offset text', () => {
  it('signs a late and an early offset, and leaves zero bare', () => {
    expect(formatOffsetMs(12)).toBe('+12 ms');
    expect(formatOffsetMs(-12)).toBe(`${MINUS}12 ms`);
    expect(formatOffsetMs(0)).toBe('0 ms');
  });
});

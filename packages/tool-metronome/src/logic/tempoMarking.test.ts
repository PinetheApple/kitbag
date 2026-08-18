import { describe, expect, it } from 'vitest';

import { tempoMarking } from './tempoMarking.ts';

describe('tempoMarking', () => {
  it('names the conventional bands', () => {
    expect(tempoMarking(50)).toBe('LARGO');
    expect(tempoMarking(90)).toBe('ANDANTE');
    expect(tempoMarking(124)).toBe('ALLEGRO');
  });

  it('names both ends of the BPM range', () => {
    expect(tempoMarking(20)).toBe('LARGO');
    expect(tempoMarking(400)).toBe('PRESTISSIMO');
  });

  it('switches on the band boundary, not inside it', () => {
    expect(tempoMarking(107)).toBe('ANDANTE');
    expect(tempoMarking(108)).toBe('MODERATO');
  });
});

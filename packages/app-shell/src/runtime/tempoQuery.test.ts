import type { StandaloneMetronomePersistence } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { queriedTempoWins } from './tempoQuery.ts';

const STORED = { bpm: 125, subdivision: 3 };

const stored: StandaloneMetronomePersistence = {
  load: () => STORED,
  save: () => undefined,
};

describe('a web tempo in the URL', () => {
  it('beats the saved tempo and leaves the rest restored', () => {
    expect(queriedTempoWins(stored, '?bpm=90').load()).toEqual({
      subdivision: 3,
    });
  });

  it.each(['', '?bpm=', '?bpm=fast', '?phase=0.5'])(
    'leaves the saved tempo when %j sets none',
    (search) => {
      expect(queriedTempoWins(stored, search).load()).toEqual(STORED);
    },
  );
});

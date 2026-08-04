// The tempo marking under the BPM readout (design §02 draws "BPM · ANDANTE ·
// SWIPE ANYWHERE").
//
// NOT SPEC-DEFINED: neither SPEC §5 nor the design file states a BPM→marking
// table, so these are the conventional Italian ranges. The design mock prints
// ANDANTE beside 124, which no conventional table agrees with (124 is Allegro);
// it is a mock label, not a range definition. Flagged for design sign-off.

interface Marking {
  readonly upTo: number;
  readonly name: string;
}

// Upper bounds, ascending. Nothing catches the top: past the last bound the
// lookup falls through to FALLBACK_MARKING.
const MARKINGS: readonly Marking[] = [
  { upTo: 60, name: 'LARGO' },
  { upTo: 66, name: 'LARGHETTO' },
  { upTo: 76, name: 'ADAGIO' },
  { upTo: 108, name: 'ANDANTE' },
  { upTo: 120, name: 'MODERATO' },
  { upTo: 156, name: 'ALLEGRO' },
  { upTo: 176, name: 'VIVACE' },
  { upTo: 200, name: 'PRESTO' },
];

const FALLBACK_MARKING = 'PRESTISSIMO';

export function tempoMarking(bpm: number): string {
  return MARKINGS.find((m) => bpm < m.upTo)?.name ?? FALLBACK_MARKING;
}

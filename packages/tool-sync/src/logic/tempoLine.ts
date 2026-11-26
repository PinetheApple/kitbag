import { FACT_SEPARATOR } from '@kitbag/core-design';
import {
  BPM_SOURCE,
  BPM_SOURCE_CREDIT,
  BPM_SOURCE_LABEL,
  notFoundText,
  type BpmSource,
  type LadderRung,
  type SourceCredit,
} from '@kitbag/core-state';

export interface TempoLineInputs {
  readonly bpm: number | null;
  readonly source: BpmSource | null;
  readonly tried: readonly LadderRung[];
  readonly looking: boolean;
}

export interface TempoLine {
  readonly lead: string;
  readonly rung: string;
  readonly tail: string;
  readonly noTempo: boolean;
  readonly credit: SourceCredit | null;
}

export const NO_TEMPO_NUMERAL = '––';
export const SET_TEMPO_HINT = 'Tap the pad or the number to set it';
const CHANGE_HINT = `${FACT_SEPARATOR}tap to change`;

const RUNG_WORDS: Readonly<Record<BpmSource, { lead: string; rung: string }>> =
  {
    [BPM_SOURCE.library]: { lead: 'via ', rung: 'your library' },
    [BPM_SOURCE.getSongBpm]: {
      lead: 'via ',
      rung: BPM_SOURCE_LABEL.getsongbpm,
    },
    [BPM_SOURCE.tap]: { lead: 'from ', rung: 'tap tempo' },
    [BPM_SOURCE.manual]: { lead: '', rung: BPM_SOURCE_LABEL.manual },
  };

const plain = (lead: string, noTempo: boolean): TempoLine => ({
  lead,
  rung: '',
  tail: '',
  noTempo,
  credit: null,
});

export function tempoLine({
  bpm,
  source,
  tried,
  looking,
}: TempoLineInputs): TempoLine {
  if (bpm !== null && source !== null) {
    const words = RUNG_WORDS[source];
    return {
      ...words,
      tail: CHANGE_HINT,
      noTempo: false,
      credit:
        source === BPM_SOURCE.getSongBpm ? BPM_SOURCE_CREDIT.getsongbpm : null,
    };
  }
  if (looking || tried.length === 0) return plain(SET_TEMPO_HINT, false);
  return plain(notFoundText(tried), true);
}

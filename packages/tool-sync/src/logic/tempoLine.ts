import { FACT_SEPARATOR } from '@kitbag/core-design';
import {
  BPM_SOURCE,
  BPM_SOURCE_CREDIT,
  BPM_SOURCE_LABEL,
  NOT_FOUND_TEXT,
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
const LOOKING_UP = 'Looking up';
const CHANGE_HINT = `${FACT_SEPARATOR}tap to change`;

const RUNG_NAME: Readonly<Record<LadderRung, string>> = {
  [BPM_SOURCE.library]: 'library',
  [BPM_SOURCE.getSongBpm]: BPM_SOURCE_LABEL.getsongbpm,
};

const FOUND_WORDS: Readonly<Record<BpmSource, { lead: string; rung: string }>> =
  {
    [BPM_SOURCE.library]: { lead: 'via ', rung: 'your library' },
    [BPM_SOURCE.getSongBpm]: {
      lead: 'via ',
      rung: RUNG_NAME[BPM_SOURCE.getSongBpm],
    },
    [BPM_SOURCE.tap]: { lead: 'from ', rung: 'tap tempo' },
    [BPM_SOURCE.manual]: { lead: '', rung: BPM_SOURCE_LABEL.manual },
  };

export function shownBpm(bpm: number): string {
  return String(Math.round(bpm));
}

const plain = (lead: string, noTempo: boolean): TempoLine => ({
  lead,
  rung: '',
  tail: '',
  noTempo,
  credit: null,
});

function notFound(tried: readonly LadderRung[]): string {
  const names = tried.map((rung) => RUNG_NAME[rung]).join(', ');
  return [NOT_FOUND_TEXT, names].join(FACT_SEPARATOR);
}

export function tempoLine({
  bpm,
  source,
  tried,
  looking,
}: TempoLineInputs): TempoLine {
  if (bpm !== null && source !== null) {
    return {
      ...FOUND_WORDS[source],
      tail: CHANGE_HINT,
      noTempo: false,
      credit:
        source === BPM_SOURCE.getSongBpm ? BPM_SOURCE_CREDIT.getsongbpm : null,
    };
  }
  if (looking) {
    const first = RUNG_NAME[BPM_SOURCE.library];
    return plain([LOOKING_UP, first].join(FACT_SEPARATOR), false);
  }
  if (tried.length === 0) return plain(SET_TEMPO_HINT, false);
  return plain(notFound(tried), true);
}

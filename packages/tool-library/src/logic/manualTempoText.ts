import { SET_TEMPO_COPY, setTempoKit } from '@kitbag/core-design';
import { MANUAL_TEMPO_RULES } from '@kitbag/core-state';

import { REANALYZE_LABEL } from './viewText.ts';

export const SONG_SET_TEMPO = setTempoKit(MANUAL_TEMPO_RULES);

export const SET_TEMPO_TEXT = {
  ...SET_TEMPO_COPY,
  reanalyse: REANALYZE_LABEL,
} as const;

export const {
  bpmText,
  offerAction,
  offerText,
  reanalyseBody,
  usingAnalysedText,
} = SONG_SET_TEMPO.text;

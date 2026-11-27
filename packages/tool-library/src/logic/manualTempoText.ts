import { SET_TEMPO_COPY, setTempoKit, tenthsClock } from '@kitbag/core-design';
import { MANUAL_TEMPO_RULES, type ManualTempo } from '@kitbag/core-state';

import { REANALYZE_LABEL } from './viewText.ts';

export const SONG_SET_TEMPO = setTempoKit(MANUAL_TEMPO_RULES);

export const SET_TEMPO_TEXT = {
  ...SET_TEMPO_COPY,
  entryReason: 'Type or tap the BPM, then mark bar 1. The click turns on.',
  menuDetail: 'Type or tap the BPM, then mark bar 1',
  fix: 'Set tempo manually',
  fixDetail: 'Fix a wrong beat',
  useAnalysed: 'Use analysed tempo',
  useAnalysedDetail: 'Drops your manual tempo',
  reanalyseTitle: 'Re-analyse this song?',
  reanalyse: REANALYZE_LABEL,
  cancel: 'Cancel',
  ok: 'OK',
  reanalysisFailed: 'Analysis failed. Your manual tempo is kept.',
  reanalysisNoBeat: 'Analysis found no beat. Your manual tempo is kept.',
  reanalysisAgrees: 'Analysis agrees with your manual tempo.',
} as const;

export const { bpmText, manualBpmText } = SONG_SET_TEMPO.text;

export const usingAnalysedText = (bpm: number) =>
  `Back to the analysed tempo: ${bpmText(bpm)}.`;

export const offerText = (bpm: number) =>
  `Analysis found ${bpmText(bpm)}. Your manual tempo is still in use.`;

export const offerAction = (bpm: number) => `Use ${manualBpmText(bpm)}`;

export const reanalyseBody = ({ bpm, anchor }: ManualTempo) =>
  `Your manual tempo, ${bpmText(bpm)} with bar 1 at ${tenthsClock(anchor)}, stays in use. If analysis finds a beat, you choose which to keep.`;

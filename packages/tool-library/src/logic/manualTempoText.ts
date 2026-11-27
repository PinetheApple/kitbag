import {
  meterCopy,
  tenthsClock,
  type SheetHintTone,
} from '@kitbag/core-design';
import {
  manualBpm,
  MANUAL_TEMPO_BOUNDS,
  MINUS,
  type ManualTempo,
} from '@kitbag/core-state';

import { REANALYZE_LABEL } from './viewText.ts';

export const MANUAL_TEMPO_LABEL = 'manual tempo';
const UNIT = 'BPM';
const PLUS = '+';

export const SET_TEMPO_TEXT = {
  title: 'Set tempo',
  close: 'Close set tempo',
  entryReason: 'Type or tap the BPM, then mark bar 1. The click turns on.',
  menuDetail: 'Type or tap the BPM, then mark bar 1',
  fix: 'Set tempo manually',
  fixDetail: 'Fix a wrong beat',
  tempo: 'Tempo',
  tempoDetail: 'Manual. Set by you.',
  useAnalysed: 'Use analysed tempo',
  useAnalysedDetail: 'Drops your manual tempo',
  type: 'Type',
  tap: 'Tap along',
  how: 'How to set the tempo',
  stepOne: 'Step 1 of 2',
  stepTwo: 'Step 2 of 2',
  backspace: 'Delete digit',
  next: 'Next',
  tapTitle: 'Tap on every beat',
  tapHint: 'Along with the song. The average of your taps sets the tempo.',
  noTempo: '––',
  startOver: 'Start over',
  barOneHelp: 'Play, pause on the one, then tap.',
  beat: 'Beat',
  beatEarlier: 'Bar 1 one beat earlier',
  beatLater: 'Bar 1 one beat later',
  beatsPerBar: meterCopy.beatsPerBar,
  slower: 'Tempo 0.1 BPM slower',
  faster: 'Tempo 0.1 BPM faster',
  back: 'Back',
  save: 'Save',
  saveFailed: 'Could not save the tempo.',
  analysedKept: 'Manual tempo saved. The analysed grid is kept.',
  reanalyseTitle: 'Re-analyse this song?',
  reanalyse: REANALYZE_LABEL,
  cancel: 'Cancel',
  ok: 'OK',
  reanalysisFailed: 'Analysis failed. Your manual tempo is kept.',
  reanalysisNoBeat: 'Analysis found no beat. Your manual tempo is kept.',
} as const;

export function manualBpmText(bpm: number): string {
  const tenths = manualBpm(bpm);
  return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
}

export const bpmText = (bpm: number) => `${manualBpmText(bpm)} ${UNIT}`;

export const wasAnalysedText = (bpm: number) =>
  `was ${manualBpmText(bpm)} from analysis`;

export const savedText = ({ bpm, anchor }: ManualTempo) =>
  `Tempo set: ${bpmText(bpm)}, bar 1 at ${tenthsClock(anchor)}.`;

export const usingAnalysedText = (bpm: number) =>
  `Back to the analysed tempo: ${bpmText(bpm)}.`;

export const offerText = (bpm: number) =>
  `Analysis found ${bpmText(bpm)}. Your manual tempo is still in use.`;

export const offerAction = (bpm: number) => `Use ${manualBpmText(bpm)}`;

export const reanalyseBody = ({ bpm, anchor }: ManualTempo) =>
  `Your manual tempo, ${bpmText(bpm)} with bar 1 at ${tenthsClock(anchor)}, stays in use. If analysis finds a beat, you choose which to keep.`;

export const halfLabel = (bpm: number) => `÷2 · ${manualBpmText(bpm)}`;
export const doubleLabel = (bpm: number) => `×2 · ${manualBpmText(bpm)}`;
export const halfSpoken = (bpm: number) => `Half time, ${bpmText(bpm)}`;
export const doubleSpoken = (bpm: number) => `Double time, ${bpmText(bpm)}`;

export interface HintText {
  readonly text: string;
  readonly tone: SheetHintTone;
}

export function typedHint(typed: number | undefined): HintText {
  const { min, max } = MANUAL_TEMPO_BOUNDS;
  if (typed !== undefined && typed > max)
    return {
      text: `Above ${String(max)} BPM. Saves as ${String(max)}.`,
      tone: 'warning',
    };
  if (typed !== undefined && typed < min)
    return {
      text: `Below ${String(min)} BPM. Saves as ${String(min)}.`,
      tone: 'warning',
    };
  return { text: `${String(min)} – ${String(max)} ${UNIT}`, tone: 'plain' };
}

export const tappedHint = (taps: number) =>
  `From ${String(taps)} taps. Keep tapping to refine.`;

export function nudgeLabel(ms: number): string {
  return `${ms < 0 ? MINUS : PLUS}${String(Math.abs(ms))} ms`;
}

export const nudgedText = (ms: number) =>
  `Moved ${nudgeLabel(ms)}. Check late in the song for drift.`;

export const nudgeSpoken = (ms: number) =>
  `Bar 1 ${String(Math.abs(ms))} milliseconds ${ms < 0 ? 'earlier' : 'later'}`;

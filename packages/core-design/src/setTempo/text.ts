import { meterCopy, tenthsClock } from '../meterText.ts';
import type { SheetHintTone } from '../components/SheetHint.tsx';
import type { SetTempoRules, TempoValue } from './rules.ts';

type BarOneTempo = Pick<TempoValue<number>, 'bpm' | 'anchor'>;

const UNIT = 'BPM';
const PLUS = '+';

export const SET_TEMPO_COPY = {
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
  beatEarlier: 'Move bar 1 a beat earlier',
  beatLater: 'Move bar 1 a beat later',
  previewClick: 'Preview click',
  previewHint: 'Hear it against the song before you save.',
  beatsPerBar: meterCopy.beatsPerBar,
  back: 'Back',
  save: 'Save',
  saveFailed: 'Could not save the tempo.',
  analysedKept: 'Manual tempo saved. The analysed grid is kept.',
  reanalyseTitle: 'Re-analyse this song?',
  cancel: 'Cancel',
  ok: 'OK',
  reanalysisFailed: 'Analysis failed. Your manual tempo is kept.',
  reanalysisNoBeat: 'Analysis found no beat. Your manual tempo is kept.',
  reanalysisAgrees: 'Analysis agrees with your manual tempo.',
} as const;

export interface HintText {
  readonly text: string;
  readonly tone: SheetHintTone;
}

export function setTempoText<M extends number>(rules: SetTempoRules<M>) {
  const { bounds, bpmStep, minus } = rules;
  const manualBpmText = (bpm: number) => {
    const tenths = rules.roundBpm(bpm);
    return Number.isInteger(tenths) ? String(tenths) : tenths.toFixed(1);
  };
  const bpmText = (bpm: number) => `${manualBpmText(bpm)} ${UNIT}`;
  const nudgeLabel = (ms: number) =>
    `${ms < 0 ? minus : PLUS}${String(Math.abs(ms))} ms`;
  return {
    manualBpmText,
    bpmText,
    slower: `Tempo ${String(bpmStep)} BPM slower`,
    faster: `Tempo ${String(bpmStep)} BPM faster`,
    wasAnalysedText: (bpm: number) =>
      `was ${manualBpmText(bpm)} from analysis`,
    savedText: ({ bpm, anchor }: BarOneTempo) =>
      `Tempo set: ${bpmText(bpm)}, bar 1 at ${tenthsClock(anchor)}.`,
    usingAnalysedText: (bpm: number) =>
      `Back to the analysed tempo: ${bpmText(bpm)}.`,
    offerText: (bpm: number) =>
      `Analysis found ${bpmText(bpm)}. Your manual tempo is still in use.`,
    offerAction: (bpm: number) => `Use ${manualBpmText(bpm)}`,
    reanalyseBody: ({ bpm, anchor }: BarOneTempo) =>
      `Your manual tempo, ${bpmText(bpm)} with bar 1 at ${tenthsClock(anchor)}, stays in use. If analysis finds a beat, you choose which to keep.`,
    halfLabel: (bpm: number) => `÷2 · ${manualBpmText(bpm)}`,
    doubleLabel: (bpm: number) => `×2 · ${manualBpmText(bpm)}`,
    halfSpoken: (bpm: number) => `Half time, ${bpmText(bpm)}`,
    doubleSpoken: (bpm: number) => `Double time, ${bpmText(bpm)}`,
    typedHint: (typed: number | undefined): HintText => {
      const { min, max } = bounds;
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
    },
    tappedHint: (taps: number) =>
      `From ${String(taps)} taps. Keep tapping to refine.`,
    nudgeLabel,
    nudgedText: (ms: number) =>
      `Moved ${nudgeLabel(ms)}. Playing with the click: check late in the song for drift.`,
    nudgeSpoken: (ms: number) =>
      `Nudge ${String(Math.abs(ms))} ms ${ms < 0 ? 'earlier' : 'later'}`,
  };
}

export type SetTempoText = ReturnType<typeof setTempoText>;

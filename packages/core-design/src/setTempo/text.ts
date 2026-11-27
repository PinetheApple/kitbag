import { meterCopy, tenthsClock } from '../meterText.ts';
import type { SheetHintTone } from '../components/SheetHint.tsx';
import type { SetTempoRules, TempoValue } from './rules.ts';

type BarOneTempo = Pick<TempoValue<number>, 'bpm' | 'anchor'>;

const UNIT = 'BPM';
const PLUS = '+';
const DRIFT_CHECK = 'Playing with the click: check late in the song for drift.';

export const SET_TEMPO_COPY = {
  title: 'Set tempo',
  close: 'Close set tempo',
  tempo: 'Tempo',
  tempoDetail: 'Manual. Set by you.',
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
    slower: `Tempo ${String(bpmStep)} ${UNIT} slower`,
    faster: `Tempo ${String(bpmStep)} ${UNIT} faster`,
    wasAnalysedText: (bpm: number) => `was ${manualBpmText(bpm)} from analysis`,
    savedText: ({ bpm, anchor }: BarOneTempo) =>
      `Tempo set: ${bpmText(bpm)}, bar 1 at ${tenthsClock(anchor)}.`,
    halfLabel: (bpm: number) => `÷2 · ${manualBpmText(bpm)}`,
    doubleLabel: (bpm: number) => `×2 · ${manualBpmText(bpm)}`,
    halfSpoken: (bpm: number) => `Half time, ${bpmText(bpm)}`,
    doubleSpoken: (bpm: number) => `Double time, ${bpmText(bpm)}`,
    typedHint: (typed: number | undefined): HintText => {
      const { min, max } = bounds;
      if (typed !== undefined && typed > max)
        return {
          text: `Above ${String(max)} ${UNIT}. Saves as ${String(max)}.`,
          tone: 'warning',
        };
      if (typed !== undefined && typed < min)
        return {
          text: `Below ${String(min)} ${UNIT}. Saves as ${String(min)}.`,
          tone: 'warning',
        };
      return { text: `${String(min)} – ${String(max)} ${UNIT}`, tone: 'plain' };
    },
    tappedHint: (taps: number) =>
      `From ${String(taps)} taps. Keep tapping to refine.`,
    nudgeLabel,
    nudgedText: (ms: number, clickOn: boolean) =>
      clickOn
        ? `Moved ${nudgeLabel(ms)}. ${DRIFT_CHECK}`
        : `Moved ${nudgeLabel(ms)}.`,
    nudgeSpoken: (ms: number) =>
      `Nudge ${String(Math.abs(ms))} ms ${ms < 0 ? 'earlier' : 'later'}`,
  };
}

export type SetTempoText = ReturnType<typeof setTempoText>;

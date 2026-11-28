import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  chosenTypedBpm,
  markedAt,
  movedByBeats,
  noSeed,
  nudged,
  startDraft,
  stepped,
  tempoSeed,
  tempoValueOf,
  type SeedSource,
  type TempoDraft,
  type TempoSeed,
} from './draft.ts';
import type { SetTempoRules, TempoValue } from './rules.ts';
import { SET_TEMPO_COPY, setTempoText, type SetTempoText } from './text.ts';
import { useSetTempoEntry, type SetTempoEntry } from './useSetTempoEntry.ts';

export const SET_TEMPO_STEP = { tempo: 1, barOne: 2 } as const;
export type SetTempoStep = (typeof SET_TEMPO_STEP)[keyof typeof SET_TEMPO_STEP];

export interface SetTempoKit<M extends number> {
  readonly rules: SetTempoRules<M>;
  readonly text: SetTempoText;
}

export const setTempoKit = <M extends number>(
  rules: SetTempoRules<M>,
): SetTempoKit<M> => ({ rules, text: setTempoText(rules) });

export interface SetTempoPlayer<M extends number> {
  readonly seed: SeedSource<M>;
  readonly durationSec: number;
  readonly playheadSeconds: () => number;
  readonly setManualTempo: (tempo: TempoValue<M>) => Promise<boolean>;
  readonly previewTempo: (tempo: TempoValue<M> | null) => void;
}

export interface SetTempoCallbacks {
  readonly onSaved?: ((message: string) => void) | undefined;
  readonly onClose: () => void;
}

function useDraftMoves<M extends number>(
  { rules }: SetTempoKit<M>,
  { durationSec, playheadSeconds }: SetTempoPlayer<M>,
) {
  const [draft, setDraft] = useState<TempoDraft<M> | null>(null);
  const moves = useMemo(() => {
    const change = (move: (now: TempoDraft<M>) => TempoDraft<M>) => {
      setDraft((now) => (now === null ? now : move(now)));
    };
    return {
      onBarOneHere: () => {
        const seconds = playheadSeconds();
        change((now) => markedAt(now, seconds));
      },
      onBeat: (beats: number) => {
        change((now) => movedByBeats(now, beats, durationSec, rules));
      },
      onNudge: (ms: number) => {
        change((now) => nudged(now, ms, durationSec, rules));
      },
      onStep: (steps: number) => {
        change((now) => stepped(now, steps, rules));
      },
      onMeter: (beatsPerBar: M) => {
        change((now) => ({ ...now, beatsPerBar }));
      },
    };
  }, [playheadSeconds, durationSec, rules]);
  return { draft, setDraft, ...moves };
}

interface SaveInputs<M extends number> extends SetTempoCallbacks {
  readonly kit: SetTempoKit<M>;
  readonly player: SetTempoPlayer<M>;
  readonly draft: TempoDraft<M> | null;
  readonly seed: TempoSeed<M>;
}

function useSave<M extends number>({
  kit,
  player,
  draft,
  seed,
  onSaved,
  onClose,
}: SaveInputs<M>) {
  const { setManualTempo } = player;
  const { savedText } = kit.text;
  const [failed, setFailed] = useState(false);
  const save = useCallback(async () => {
    if (draft === null) return;
    const tempo = tempoValueOf(draft);
    if (!(await setManualTempo(tempo))) {
      setFailed(true);
      return;
    }
    onSaved?.(seed.analysed ? SET_TEMPO_COPY.analysedKept : savedText(tempo));
    onClose();
  }, [draft, seed, setManualTempo, savedText, onSaved, onClose]);
  const onSave = useCallback(() => {
    void save();
  }, [save]);
  const clearFailed = useCallback(() => {
    setFailed(false);
  }, []);
  return { failed, setFailed, clearFailed, onSave };
}

interface StepFlowInputs<M extends number> {
  readonly kit: SetTempoKit<M>;
  readonly player: SetTempoPlayer<M>;
  readonly seed: TempoSeed<M>;
  readonly entry: SetTempoEntry<M>;
  readonly draft: TempoDraft<M> | null;
  readonly setDraft: (draft: TempoDraft<M> | null) => void;
}

function useStepFlow<M extends number>({
  kit,
  player,
  seed,
  entry,
  draft,
  setDraft,
}: StepFlowInputs<M>) {
  const { playheadSeconds } = player;
  const { rules } = kit;
  const [step, setStep] = useState<SetTempoStep>(SET_TEMPO_STEP.tempo);
  const toBarOne = useCallback(
    (bpm: number | null | undefined) => {
      if (bpm === null || bpm === undefined) return;
      setDraft(startDraft(bpm, draft ?? seed, playheadSeconds(), rules));
      setStep(SET_TEMPO_STEP.barOne);
    },
    [draft, seed, setDraft, playheadSeconds, rules],
  );
  const onTyped = useCallback(() => {
    toBarOne(chosenTypedBpm(entry.numpad, seed.bpm, rules));
  }, [toBarOne, entry.numpad, seed.bpm, rules]);
  const onTapped = useCallback(() => {
    toBarOne(entry.tappedBpm);
  }, [toBarOne, entry.tappedBpm]);
  const onBack = useCallback(() => {
    setStep(SET_TEMPO_STEP.tempo);
  }, []);
  return { step, setStep, onTyped, onTapped, onBack };
}

export function useSetTempo<M extends number>(
  kit: SetTempoKit<M>,
  player: SetTempoPlayer<M>,
  { onSaved, onClose }: SetTempoCallbacks,
) {
  const { rules } = kit;
  const [seed, setSeed] = useState(() => noSeed(rules));
  const entry = useSetTempoEntry(seed, rules);
  const moves = useDraftMoves(kit, player);
  const { draft, setDraft } = moves;
  const saving = useSave({ kit, player, draft, seed, onSaved, onClose });
  const flow = useStepFlow({ kit, player, seed, entry, draft, setDraft });
  const { resetModes } = entry;
  const { setFailed } = saving;
  const { setStep } = flow;
  const { seed: source } = player;
  const onShow = useCallback(() => {
    const next = tempoSeed(source, rules);
    setSeed(next);
    resetModes(next);
    setDraft(null);
    setFailed(false);
    setStep(SET_TEMPO_STEP.tempo);
  }, [source, rules, resetModes, setDraft, setFailed, setStep]);
  return {
    kit,
    seed,
    entry,
    draft,
    step: flow.step,
    failed: saving.failed,
    clearFailed: saving.clearFailed,
    onSave: saving.onSave,
    onShow,
    onTyped: flow.onTyped,
    onTapped: flow.onTapped,
    onBack: flow.onBack,
    onBarOneHere: moves.onBarOneHere,
    onBeat: moves.onBeat,
    onNudge: moves.onNudge,
    onStep: moves.onStep,
    onMeter: moves.onMeter,
  };
}

export interface SetTempo<M extends number = number> {
  readonly kit: SetTempoKit<M>;
  readonly seed: TempoSeed<M>;
  readonly entry: SetTempoEntry<M>;
  readonly draft: TempoDraft<M> | null;
  readonly step: SetTempoStep;
  readonly failed: boolean;
  readonly clearFailed: () => void;
  readonly onSave: () => void;
  readonly onShow: () => void;
  readonly onTyped: () => void;
  readonly onTapped: () => void;
  readonly onBack: () => void;
  readonly onBarOneHere: () => void;
  readonly onBeat: (beats: number) => void;
  readonly onNudge: (ms: number) => void;
  readonly onStep: (steps: number) => void;
  readonly onMeter: (beatsPerBar: M) => void;
}

export function useTempoPreview<M extends number>(
  { draft, step }: Pick<SetTempo<M>, 'draft' | 'step'>,
  open: boolean,
  previewTempo: (tempo: TempoValue<M> | null) => void,
) {
  const shown = open && step === SET_TEMPO_STEP.barOne ? draft : null;
  const tempo = useMemo(
    () => (shown === null ? null : tempoValueOf(shown)),
    [shown],
  );
  useEffect(() => {
    previewTempo(tempo);
  }, [previewTempo, tempo]);
  useEffect(
    () => () => {
      previewTempo(null);
    },
    [previewTempo],
  );
}

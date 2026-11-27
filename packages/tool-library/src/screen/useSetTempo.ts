import {
  framesToSeconds,
  useLiveSongPlayer,
  useSongPlayer,
  type GridMeter,
} from '@kitbag/core-state';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  chosenTypedBpm,
  manualTempoOf,
  markedAt,
  movedByBeats,
  nudged,
  NO_SEED,
  startDraft,
  stepped,
  tempoSeed,
  type TempoDraft,
  type TempoSeed,
} from '../logic/manualTempoDraft.ts';
import { SET_TEMPO_TEXT, savedText } from '../logic/manualTempoText.ts';
import { useSetTempoEntry, type SetTempoEntry } from './useSetTempoEntry.ts';

export const SET_TEMPO_STEP = { tempo: 1, barOne: 2 } as const;
export type SetTempoStep = (typeof SET_TEMPO_STEP)[keyof typeof SET_TEMPO_STEP];

function useSeedNow(): () => TempoSeed {
  const manualTempo = useSongPlayer((s) => s.manualTempo);
  const analysedBpm = useSongPlayer((s) => s.analysedBpm);
  const detected = useSongPlayer((s) => s.detected);
  const override = useSongPlayer((s) => s.meterOverride);
  return useCallback(
    () =>
      tempoSeed({
        manualTempo,
        analysedBpm,
        barOneSeconds: override.barOneSeconds ?? detected.barOneSeconds,
        meter: override.meterBeatsPerBar ?? detected.meter,
      }),
    [manualTempo, analysedBpm, detected, override],
  );
}

function useDraftMoves(durationSec: number) {
  const [draft, setDraft] = useState<TempoDraft | null>(null);
  const playheadSeconds = useLiveSongPlayer((s) => s.playheadSeconds);
  const moves = useMemo(() => {
    const change = (move: (now: TempoDraft) => TempoDraft) => {
      setDraft((now) => (now === null ? now : move(now)));
    };
    return {
      onBarOneHere: () => {
        const seconds = playheadSeconds();
        change((now) => markedAt(now, seconds));
      },
      onBeat: (beats: number) => {
        change((now) => movedByBeats(now, beats, durationSec));
      },
      onNudge: (ms: number) => {
        change((now) => nudged(now, ms, durationSec));
      },
      onStep: (steps: number) => {
        change((now) => stepped(now, steps));
      },
      onMeter: (beatsPerBar: GridMeter) => {
        change((now) => ({ ...now, beatsPerBar }));
      },
    };
  }, [playheadSeconds, durationSec]);
  return { draft, setDraft, ...moves };
}

interface SaveInputs {
  readonly draft: TempoDraft | null;
  readonly seed: TempoSeed;
  readonly onSaved: (message: string) => void;
  readonly onClose: () => void;
}

function useSave({ draft, seed, onSaved, onClose }: SaveInputs) {
  const setManualTempo = useLiveSongPlayer((s) => s.setManualTempo);
  const toggleClick = useLiveSongPlayer((s) => s.toggleClick);
  const click = useSongPlayer((s) => s.click);
  const [failed, setFailed] = useState(false);
  const save = useCallback(async () => {
    if (draft === null) return;
    const tempo = manualTempoOf(draft);
    if (!(await setManualTempo(tempo))) {
      setFailed(true);
      return;
    }
    if (!click) void toggleClick();
    onSaved(seed.analysed ? SET_TEMPO_TEXT.analysedKept : savedText(tempo));
    onClose();
  }, [draft, seed, setManualTempo, click, toggleClick, onSaved, onClose]);
  const onSave = useCallback(() => {
    void save();
  }, [save]);
  const clearFailed = useCallback(() => {
    setFailed(false);
  }, []);
  return { failed, setFailed, clearFailed, onSave };
}

export interface SetTempoCallbacks {
  readonly onSaved: (message: string) => void;
  readonly onClose: () => void;
}

interface StepFlowInputs {
  readonly seed: TempoSeed;
  readonly entry: SetTempoEntry;
  readonly draft: TempoDraft | null;
  readonly setDraft: (draft: TempoDraft | null) => void;
}

function useStepFlow({ seed, entry, draft, setDraft }: StepFlowInputs) {
  const playheadSeconds = useLiveSongPlayer((s) => s.playheadSeconds);
  const [step, setStep] = useState<SetTempoStep>(SET_TEMPO_STEP.tempo);
  const toBarOne = useCallback(
    (bpm: number | null | undefined) => {
      if (bpm === null || bpm === undefined) return;
      const from = { ...seed, ...draft };
      setDraft(startDraft(bpm, from, playheadSeconds()));
      setStep(SET_TEMPO_STEP.barOne);
    },
    [draft, seed, setDraft, playheadSeconds],
  );
  const onTyped = useCallback(() => {
    toBarOne(chosenTypedBpm(entry.entry, seed.bpm));
  }, [toBarOne, entry.entry, seed.bpm]);
  const onTapped = useCallback(() => {
    toBarOne(entry.tappedBpm);
  }, [toBarOne, entry.tappedBpm]);
  const onBack = useCallback(() => {
    setStep(SET_TEMPO_STEP.tempo);
  }, []);
  return { step, setStep, onTyped, onTapped, onBack };
}

export function useSetTempo({ onSaved, onClose }: SetTempoCallbacks) {
  const durationSec = useSongPlayer((s) =>
    framesToSeconds(s.durationFrames, s.engineRate),
  );
  const seedNow = useSeedNow();
  const [seed, setSeed] = useState(NO_SEED);
  const entry = useSetTempoEntry(seed);
  const moves = useDraftMoves(durationSec);
  const saving = useSave({ draft: moves.draft, seed, onSaved, onClose });
  const { draft, setDraft } = moves;
  const flow = useStepFlow({ seed, entry, draft, setDraft });
  const { resetModes } = entry;
  const { setFailed } = saving;
  const { setStep } = flow;
  const onShow = useCallback(() => {
    const next = seedNow();
    setSeed(next);
    resetModes(next);
    setDraft(null);
    setFailed(false);
    setStep(SET_TEMPO_STEP.tempo);
  }, [seedNow, resetModes, setDraft, setFailed, setStep]);
  return { seed, durationSec, entry, ...moves, ...saving, ...flow, onShow };
}

export type SetTempo = ReturnType<typeof useSetTempo>;

export function useTempoPreview(
  { draft, step }: Pick<SetTempo, 'draft' | 'step'>,
  open: boolean,
) {
  const previewTempo = useLiveSongPlayer((s) => s.previewTempo);
  const shown = open && step === SET_TEMPO_STEP.barOne ? draft : null;
  const tempo = useMemo(
    () => (shown === null ? null : manualTempoOf(shown)),
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

export function useSetTempoOpen() {
  const [open, setOpen] = useState(false);
  const show = useCallback(() => {
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
  }, []);
  return { open, show, hide };
}

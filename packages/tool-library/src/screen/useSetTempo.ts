import {
  constantGrid,
  framesToSeconds,
  useLiveSongPlayer,
  useSongPlayer,
  type DetectedGrid,
  type GridMeter,
} from '@kitbag/core-state';
import { useCallback, useMemo, useState } from 'react';

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
import { useSetTempoEntry } from './useSetTempoEntry.ts';

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
  const change = useCallback((move: (now: TempoDraft) => TempoDraft) => {
    setDraft((now) => (now === null ? now : move(now)));
  }, []);
  return {
    draft,
    setDraft,
    onBarOneHere: useCallback(() => {
      const seconds = playheadSeconds();
      change((now) => markedAt(now, seconds));
    }, [change, playheadSeconds]),
    onBeat: useCallback(
      (beats: number) => {
        change((now) => movedByBeats(now, beats, durationSec));
      },
      [change, durationSec],
    ),
    onNudge: useCallback(
      (ms: number) => {
        change((now) => nudged(now, ms, durationSec));
      },
      [change, durationSec],
    ),
    onStep: useCallback(
      (steps: number) => {
        change((now) => stepped(now, steps));
      },
      [change],
    ),
    onMeter: useCallback(
      (beatsPerBar: GridMeter) => {
        change((now) => ({ ...now, beatsPerBar }));
      },
      [change],
    ),
  };
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

export function useSetTempo({ onSaved, onClose }: SetTempoCallbacks) {
  const durationSec = useSongPlayer((s) =>
    framesToSeconds(s.durationFrames, s.engineRate),
  );
  const seedNow = useSeedNow();
  const playheadSeconds = useLiveSongPlayer((s) => s.playheadSeconds);
  const [seed, setSeed] = useState(NO_SEED);
  const [step, setStep] = useState<SetTempoStep>(SET_TEMPO_STEP.tempo);
  const entry = useSetTempoEntry(seed);
  const moves = useDraftMoves(durationSec);
  const saving = useSave({ draft: moves.draft, seed, onSaved, onClose });
  const { resetModes } = entry;
  const { setDraft, draft } = moves;
  const { setFailed } = saving;
  const onShow = useCallback(() => {
    const next = seedNow();
    setSeed(next);
    resetModes(next);
    setDraft(null);
    setFailed(false);
    setStep(SET_TEMPO_STEP.tempo);
  }, [seedNow, resetModes, setDraft, setFailed]);
  const toBarOne = useCallback(
    (bpm: number | null | undefined) => {
      if (bpm === null || bpm === undefined) return;
      const from = draft ?? seed;
      setDraft(startDraft(bpm, { ...seed, ...from }, playheadSeconds()));
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
  return {
    seed,
    step,
    durationSec,
    entry,
    ...moves,
    ...saving,
    onShow,
    onTyped,
    onTapped,
    onBack,
  };
}

export type SetTempo = ReturnType<typeof useSetTempo>;

export function useDraftGrid(
  { draft, step, durationSec }: SetTempo,
  open: boolean,
): DetectedGrid | null {
  return useMemo(() => {
    if (!open || step !== SET_TEMPO_STEP.barOne || draft === null) return null;
    return constantGrid(manualTempoOf(draft), durationSec);
  }, [open, step, draft, durationSec]);
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

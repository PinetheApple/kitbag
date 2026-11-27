import { ConfirmDialog, snackbar, Snackbar } from '@kitbag/core-design';
import {
  useLiveSongPlayer,
  useSongLibrary,
  useSongPlayer,
} from '@kitbag/core-state';
import { useCallback, useEffect } from 'react';

import {
  offerAction,
  offerText,
  reanalyseBody,
  SET_TEMPO_TEXT,
  usingAnalysedText,
} from '../logic/manualTempoText.ts';
import {
  REANALYSIS,
  watchReanalysis,
  type ReanalysisPhase,
} from '../logic/reanalysisWatch.ts';
import { UNDO_LABEL } from '../logic/songMeterText.ts';
import { NoteAnchor } from './NoteAnchor.tsx';
import { useSongKeyed } from './useSongKeyed.ts';

const IDLE: ReanalysisPhase = REANALYSIS.idle;

function useReanalysisWatch(songId: number) {
  const [phase, setPhase] = useSongKeyed(songId, IDLE);
  const [notice, setNotice] = useSongKeyed<string | null>(songId, null);
  const status = useSongPlayer((s) => s.analysisStatus);
  const analysedBpm = useSongPlayer((s) => s.analysedBpm);
  const manualTempoBpm = useSongPlayer((s) => s.manualTempo?.bpm ?? null);
  const offerAnalysed = useLiveSongPlayer((s) => s.offerAnalysed);
  useEffect(() => {
    const next = watchReanalysis(phase, {
      status,
      analysedBpm,
      manualTempoBpm,
    });
    if (next.phase !== phase) setPhase(next.phase);
    if (next.notice !== null) setNotice(next.notice);
    if (next.offer) offerAnalysed();
  }, [
    phase,
    status,
    analysedBpm,
    manualTempoBpm,
    setPhase,
    setNotice,
    offerAnalysed,
  ]);
  const arm = useCallback(() => {
    setPhase(REANALYSIS.asked);
  }, [setPhase]);
  const disarm = useCallback(() => {
    setPhase(IDLE);
  }, [setPhase]);
  const clear = useCallback(() => {
    setNotice(null);
  }, [setNotice]);
  return { notice, arm, disarm, clear };
}

function useAnalysedSwitch(onUndoable: (message: string) => void) {
  const applyAnalysed = useLiveSongPlayer((s) => s.useAnalysedTempo);
  const analysedBpm = useSongPlayer((s) => s.analysedBpm);
  return useCallback(() => {
    if (analysedBpm === null) return;
    void applyAnalysed().then((switched) => {
      if (switched) onUndoable(usingAnalysedText(analysedBpm));
    });
  }, [applyAnalysed, analysedBpm, onUndoable]);
}

export function useManualTempoNotices(songId: number) {
  const [undoNote, setUndoNote] = useSongKeyed<string | null>(songId, null);
  const [asking, setAsking] = useSongKeyed(songId, false);
  const reanalyze = useSongLibrary((s) => s.reanalyze);
  const watch = useReanalysisWatch(songId);
  const { arm, disarm } = watch;
  const onUseAnalysed = useAnalysedSwitch(setUndoNote);
  const onAsk = useCallback(() => {
    setAsking(true);
  }, [setAsking]);
  const onCancel = useCallback(() => {
    setAsking(false);
  }, [setAsking]);
  const onConfirm = useCallback(() => {
    setAsking(false);
    arm();
    reanalyze(songId).catch(disarm);
  }, [setAsking, arm, disarm, reanalyze, songId]);
  return {
    undoNote,
    setUndoNote,
    asking,
    watch,
    onAsk,
    onCancel,
    onConfirm,
    onUseAnalysed,
  };
}

export type ManualTempoNoticeState = ReturnType<typeof useManualTempoNotices>;

interface NoticesProps {
  readonly notices: ManualTempoNoticeState;
}

function UndoNotice({ notices }: NoticesProps) {
  const undoTempo = useLiveSongPlayer((s) => s.undoTempo);
  const dismiss = useLiveSongPlayer((s) => s.dismissTempoUndo);
  const { undoNote, setUndoNote } = notices;
  const onUndo = useCallback(() => {
    setUndoNote(null);
    void undoTempo();
  }, [setUndoNote, undoTempo]);
  const onTimeout = useCallback(() => {
    setUndoNote(null);
    dismiss();
  }, [setUndoNote, dismiss]);
  if (undoNote === null) return null;
  return (
    <Snackbar
      message={undoNote}
      actionLabel={UNDO_LABEL}
      bottom={snackbar.aboveDock}
      onAction={onUndo}
      onTimeout={onTimeout}
    />
  );
}

function OfferNotice({ notices }: NoticesProps) {
  const offer = useSongPlayer((s) => s.analysedOffer);
  const dismiss = useLiveSongPlayer((s) => s.dismissAnalysedOffer);
  if (offer === null) return null;
  return (
    <Snackbar
      message={offerText(offer)}
      actionLabel={offerAction(offer)}
      bottom={snackbar.aboveDock}
      onAction={notices.onUseAnalysed}
      onTimeout={dismiss}
    />
  );
}

function ResultNotice({ notices }: NoticesProps) {
  const { notice, clear } = notices.watch;
  if (notice === null) return null;
  return (
    <Snackbar
      message={notice}
      actionLabel={SET_TEMPO_TEXT.ok}
      bottom={snackbar.aboveDock}
      onAction={clear}
      onTimeout={clear}
    />
  );
}

function ActiveNotice({ notices }: NoticesProps) {
  const offering = useSongPlayer((s) => s.analysedOffer !== null);
  if (notices.undoNote !== null) return <UndoNotice notices={notices} />;
  if (offering) return <OfferNotice notices={notices} />;
  return <ResultNotice notices={notices} />;
}

function ReanalyseDialog({ notices }: NoticesProps) {
  const manualTempo = useSongPlayer((s) => s.manualTempo);
  if (!notices.asking || manualTempo === null) return null;
  return (
    <ConfirmDialog
      title={SET_TEMPO_TEXT.reanalyseTitle}
      body={reanalyseBody(manualTempo)}
      cancelLabel={SET_TEMPO_TEXT.cancel}
      confirmLabel={SET_TEMPO_TEXT.reanalyse}
      onConfirm={notices.onConfirm}
      onCancel={notices.onCancel}
    />
  );
}

export function ManualTempoNotices({ notices }: NoticesProps) {
  return (
    <>
      <NoteAnchor>
        <ActiveNotice notices={notices} />
      </NoteAnchor>
      <ReanalyseDialog notices={notices} />
    </>
  );
}

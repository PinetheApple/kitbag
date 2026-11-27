import { ConfirmDialog, snackbar, Snackbar } from '@kitbag/core-design';
import {
  useLiveSongPlayer,
  useSongLibrary,
  useSongPlayer,
} from '@kitbag/core-state';
import { useCallback, useEffect, useState } from 'react';

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

function useReanalysisWatch() {
  const [stage, setStage] = useState<ReanalysisPhase>(REANALYSIS.idle);
  const [notice, setNotice] = useState<string | null>(null);
  const status = useSongPlayer((s) => s.analysisStatus);
  const analysedBpm = useSongPlayer((s) => s.analysedBpm);
  useEffect(() => {
    const next = watchReanalysis(stage, status, analysedBpm);
    if (next.phase !== stage) setStage(next.phase);
    if (next.notice !== null) setNotice(next.notice);
  }, [stage, status, analysedBpm]);
  const arm = useCallback(() => {
    setStage(REANALYSIS.asked);
  }, []);
  const clear = useCallback(() => {
    setNotice(null);
  }, []);
  return { notice, arm, clear };
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
  const [undoNote, setUndoNote] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const reanalyze = useSongLibrary((s) => s.reanalyze);
  const watch = useReanalysisWatch();
  const { arm } = watch;
  const onUseAnalysed = useAnalysedSwitch(setUndoNote);
  const onAsk = useCallback(() => {
    setAsking(true);
  }, []);
  const onCancel = useCallback(() => {
    setAsking(false);
  }, []);
  const onConfirm = useCallback(() => {
    setAsking(false);
    arm();
    void reanalyze(songId);
  }, [arm, reanalyze, songId]);
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

function UndoNotice({ notices }: { readonly notices: ManualTempoNoticeState }) {
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

function OfferNotice({
  notices,
}: {
  readonly notices: ManualTempoNoticeState;
}) {
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

function ResultNotice({
  notices,
}: {
  readonly notices: ManualTempoNoticeState;
}) {
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

function ReanalyseDialog({
  notices,
}: {
  readonly notices: ManualTempoNoticeState;
}) {
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

export function ManualTempoNotices({
  notices,
}: {
  readonly notices: ManualTempoNoticeState;
}) {
  const offering = useSongPlayer((s) => s.analysedOffer !== null);
  const notice = (() => {
    if (notices.undoNote !== null) return <UndoNotice notices={notices} />;
    if (offering) return <OfferNotice notices={notices} />;
    return <ResultNotice notices={notices} />;
  })();
  return (
    <>
      <NoteAnchor>{notice}</NoteAnchor>
      <ReanalyseDialog notices={notices} />
    </>
  );
}

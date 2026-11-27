import { Sheet, Snackbar } from '@kitbag/core-design';

import { SET_TEMPO_TEXT, wasAnalysedText } from '../logic/manualTempoText.ts';
import type { SongPlayhead } from './playhead.ts';
import { SetTempoStepOne } from './SetTempoStepOne.tsx';
import { SetTempoStepTwo } from './SetTempoStepTwo.tsx';
import { SET_TEMPO_STEP, type SetTempo } from './useSetTempo.ts';

export interface SetTempoSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly playhead: SongPlayhead;
  readonly tempo: SetTempo;
  readonly onClose: () => void;
}

function stepDetail({ step, seed }: SetTempo): string {
  if (step === SET_TEMPO_STEP.barOne) return SET_TEMPO_TEXT.stepTwo;
  return seed.analysed && seed.bpm !== null
    ? wasAnalysedText(seed.bpm)
    : SET_TEMPO_TEXT.stepOne;
}

export function SetTempoSheet({
  visible,
  bottomInset,
  playhead,
  tempo,
  onClose,
}: SetTempoSheetProps) {
  const { draft } = tempo;
  const barOne = tempo.step === SET_TEMPO_STEP.barOne && draft !== null;
  return (
    <Sheet
      visible={visible}
      title={SET_TEMPO_TEXT.title}
      titleDetail={stepDetail(tempo)}
      dismissLabel={SET_TEMPO_TEXT.close}
      bottomInset={bottomInset}
      notice={
        tempo.failed ? (
          <Snackbar
            inline
            message={SET_TEMPO_TEXT.saveFailed}
            onTimeout={tempo.clearFailed}
          />
        ) : undefined
      }
      onShow={tempo.onShow}
      onDismiss={onClose}
    >
      {barOne ? (
        <SetTempoStepTwo tempo={tempo} draft={draft} playhead={playhead} />
      ) : (
        <SetTempoStepOne tempo={tempo} playhead={playhead} />
      )}
    </Sheet>
  );
}

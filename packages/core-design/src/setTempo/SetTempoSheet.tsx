import { Sheet } from '../components/Sheet.tsx';
import { Snackbar } from '../components/Snackbar.tsx';
import { SetTempoStepOne } from './SetTempoStepOne.tsx';
import { SetTempoStepTwo, type PreviewClickProps } from './SetTempoStepTwo.tsx';
import type {
  SetTempoPlayhead,
  SetTempoTransportProps,
} from './SetTempoTransport.tsx';
import { SET_TEMPO_COPY } from './text.ts';
import { SET_TEMPO_STEP, type SetTempo } from './useSetTempo.ts';

export interface SetTempoSheetProps<M extends number> {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly playhead: SetTempoPlayhead;
  readonly tempo: SetTempo<M>;
  readonly transport: SetTempoTransportProps;
  readonly previewClick: PreviewClickProps;
  readonly onClose: () => void;
}

function stepDetail<M extends number>({ step, seed, kit }: SetTempo<M>) {
  if (step === SET_TEMPO_STEP.barOne) return SET_TEMPO_COPY.stepTwo;
  return seed.analysed && seed.bpm !== null
    ? kit.text.wasAnalysedText(seed.bpm)
    : SET_TEMPO_COPY.stepOne;
}

export function SetTempoSheet<M extends number>({
  visible,
  bottomInset,
  playhead,
  tempo,
  transport,
  previewClick,
  onClose,
}: SetTempoSheetProps<M>) {
  const { draft } = tempo;
  const barOne = tempo.step === SET_TEMPO_STEP.barOne && draft !== null;
  return (
    <Sheet
      visible={visible}
      title={SET_TEMPO_COPY.title}
      titleDetail={stepDetail(tempo)}
      dismissLabel={SET_TEMPO_COPY.close}
      bottomInset={bottomInset}
      notice={
        tempo.failed ? (
          <Snackbar
            inline
            message={SET_TEMPO_COPY.saveFailed}
            onTimeout={tempo.clearFailed}
          />
        ) : undefined
      }
      onShow={tempo.onShow}
      onDismiss={onClose}
    >
      {barOne ? (
        <SetTempoStepTwo
          tempo={tempo}
          draft={draft}
          playhead={playhead}
          transport={transport}
          previewClick={previewClick}
        />
      ) : (
        <SetTempoStepOne
          tempo={tempo}
          playhead={playhead}
          transport={transport}
        />
      )}
    </Sheet>
  );
}

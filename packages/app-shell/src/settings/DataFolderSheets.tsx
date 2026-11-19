import {
  Button,
  createThemedStyles,
  Sheet,
  SheetHint,
  space,
  useTextScaled,
  type IconName,
} from '@kitbag/core-design';
import type {
  DataFolderCodes,
  DataFolderVolumes,
  MoveStatus,
} from '@kitbag/core-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChooserBody, ConfirmBody, MovingBody } from './DataFolderBodies.tsx';
import type {
  DataFolderAction,
  DataFolderSheet,
  SheetAction,
} from './dataFolderFlow.ts';
import {
  moveErrorText,
  pausedHint,
  phaseText,
  stopHint,
  switchedFailedText,
  switchedHint,
  switchedTitle,
  type ErrorText,
  type Places,
} from './dataFolderMoveText.ts';
import {
  CANCEL,
  CANCEL_MOVE,
  CHOOSE_ANOTHER,
  CLOSE_DATA_FOLDER,
  confirmTitle,
  DATA_FOLDER_LABEL,
  KEEP_MOVING,
  MOVE,
  movingTitle,
  NOT_NOW,
  OK,
  pausedTitle,
  RESUME,
  STOP_MOVING,
  STOP_TITLE,
  TRY_AGAIN,
  UNDO,
  type MediaSize,
} from './dataFolderText.ts';
import type { DataFolderSheetsModel } from './useDataFolderSheets.ts';

const LABELS: Readonly<Record<DataFolderAction, string>> = {
  move: MOVE,
  backToChooser: CANCEL,
  askStop: CANCEL_MOVE,
  stop: STOP_MOVING,
  keepMoving: KEEP_MOVING,
  resume: RESUME,
  undo: UNDO,
  notNow: NOT_NOW,
  ok: OK,
  chooseAnother: CHOOSE_ANOTHER,
};

const useStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', gap: space.controlGap },
  stacked: { gap: space.controlGap },
}));

function actionLabel(id: DataFolderAction, sheet: DataFolderSheet): string {
  const retry = id === 'resume' && sheet.kind !== 'paused';
  return retry ? TRY_AGAIN : LABELS[id];
}

function Actions({
  sheet,
  actions,
  handlers,
}: {
  readonly sheet: DataFolderSheet;
  readonly actions: readonly SheetAction[];
  readonly handlers: Readonly<Record<DataFolderAction, () => void>>;
}) {
  const styles = useStyles();
  const stacked = useTextScaled();
  if (actions.length === 0) return null;
  const ordered = stacked ? [...actions].reverse() : actions;
  return (
    <View style={stacked ? styles.stacked : styles.row}>
      {ordered.map((action) => (
        <Button
          key={action.id}
          fill
          variant={action.primary ? 'primary' : 'ghost'}
          label={actionLabel(action.id, sheet)}
          disabled={action.disabled}
          onPress={handlers[action.id]}
        />
      ))}
    </View>
  );
}

interface SheetFace {
  readonly title: string;
  readonly icon?: IconName;
  readonly body: ReactNode;
}

interface FaceContext {
  readonly volumes: DataFolderVolumes;
  readonly codes: DataFolderCodes;
  readonly media: MediaSize | null;
  readonly pending: boolean;
  readonly places: Places;
  readonly storeError: string | null;
  readonly onChoose: (volumeUuid: string | null) => void;
}

function errorFace(text: ErrorText): SheetFace {
  return {
    title: text.title,
    icon: 'error',
    body: <SheetHint>{text.body}</SheetHint>,
  };
}

function switchedFace(move: MoveStatus, codes: DataFolderCodes): SheetFace {
  return {
    title: switchedTitle(move),
    icon: 'moveFolder',
    body: (
      <>
        {move.running ? (
          <SheetHint>{phaseText(move.phase, codes.movePhases)}</SheetHint>
        ) : null}
        <SheetHint>{switchedHint(move)}</SheetHint>
      </>
    ),
  };
}

function sheetFace(sheet: DataFolderSheet, context: FaceContext): SheetFace {
  const { volumes, codes, media, pending, onChoose } = context;
  switch (sheet.kind) {
    case 'none':
    case 'chooser':
      return {
        title: DATA_FOLDER_LABEL,
        icon: 'dataFolder',
        body: (
          <ChooserBody
            volumes={volumes}
            codes={codes}
            media={media}
            pending={pending}
            onChoose={onChoose}
          />
        ),
      };
    case 'confirm':
      return {
        title: confirmTitle(sheet.target),
        icon: 'moveFolder',
        body: (
          <ConfirmBody volumes={volumes} target={sheet.target} media={media} />
        ),
      };
    case 'moving': {
      const notice = context.storeError;
      return {
        title: movingTitle(sheet.move),
        icon: 'moveFolder',
        body: (
          <MovingBody
            move={sheet.move}
            phases={codes.movePhases}
            notice={
              notice === null
                ? null
                : moveErrorText(notice, codes, context.places).body
            }
          />
        ),
      };
    }
    case 'stopAsk':
      return {
        title: STOP_TITLE,
        body: <SheetHint>{stopHint(sheet.move, codes.movePhases)}</SheetHint>,
      };
    case 'switched':
      return switchedFace(sheet.move, codes);
    case 'switchedFailed':
      return errorFace(switchedFailedText(sheet.move));
    case 'paused':
      return {
        title: pausedTitle(sheet.move),
        icon: 'moveFolder',
        body: <SheetHint>{pausedHint(sheet.move, codes.movePhases)}</SheetHint>,
      };
    case 'stopped':
    case 'failed':
      return errorFace(moveErrorText(sheet.error, codes, context.places));
  }
}

function otherPlace(volumes: DataFolderVolumes): string | null {
  return volumes.volumes.find((volume) => !volume.inUse)?.volumeUuid ?? null;
}

export interface DataFolderSheetsProps {
  readonly model: DataFolderSheetsModel;
  readonly media: MediaSize | null;
}

export function DataFolderSheets({ model, media }: DataFolderSheetsProps) {
  const insets = useSafeAreaInsets();
  const {
    sheet,
    actions,
    pending,
    codes,
    confirmTarget,
    volumes,
    move,
    error: storeError,
  } = model;
  if (volumes === null || codes === null) return null;
  const places: Places = {
    source: move?.sourceVolumeUuid ?? volumes.currentVolumeUuid,
    target: move?.targetVolumeUuid ?? confirmTarget ?? otherPlace(volumes),
  };
  const face = sheetFace(sheet, {
    volumes,
    codes,
    media,
    pending,
    places,
    storeError,
    onChoose: model.choose,
  });
  return (
    <Sheet
      visible={sheet.kind !== 'none'}
      title={face.title}
      {...(face.icon === undefined ? {} : { titleIcon: face.icon })}
      dismissLabel={CLOSE_DATA_FOLDER}
      bottomInset={insets.bottom}
      onDismiss={model.close}
    >
      {face.body}
      <Actions sheet={sheet} actions={actions} handlers={model.act} />
    </Sheet>
  );
}

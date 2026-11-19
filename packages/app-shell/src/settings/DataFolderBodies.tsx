import {
  createThemedStyles,
  dataFolderType,
  EditValue,
  LinearProgress,
  SheetHint,
  space,
  textStyle,
} from '@kitbag/core-design';
import type {
  DataFolderCodes,
  DataFolderVolumes,
  MovePhases,
  MoveStatus,
} from '@kitbag/core-native';
import { Text, View } from 'react-native';

import {
  movePercent,
  findVolume,
  freeAfterLabel,
  freeAfterText,
  mediaText,
  noSpaceHint,
  volumeName,
  volumeOption,
  CHOOSER_HINT,
  CONFIRM_HINTS,
  MOVING_CLOSE_HINT,
  NO_CARD_HINT,
  type MediaSize,
} from './dataFolderText.ts';
import {
  movingHint,
  phaseText,
  progressBytes,
  progressFiles,
  progressLabel,
} from './dataFolderMoveText.ts';
import { SheetRow } from './StorageSheet.tsx';
import { VolumeOptionRow } from './VolumeOptionRow.tsx';

const SINGLE_VOLUME = 1;

const useStyles = createThemedStyles((theme) => ({
  options: { gap: space.controlGap },
  numbers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: space.controlGap,
  },
  number: {
    ...textStyle(dataFolderType.progress),
    color: theme.color.text,
  },
  of: { color: theme.color.text3 },
}));

export interface ChooserBodyProps {
  readonly volumes: DataFolderVolumes;
  readonly codes: DataFolderCodes;
  readonly media: MediaSize | null;
  readonly pending: boolean;
  readonly onChoose: (volumeUuid: string | null) => void;
}

export function ChooserBody({
  volumes,
  codes,
  media,
  pending,
  onChoose,
}: ChooserBodyProps) {
  const styles = useStyles();
  const options = volumes.volumes.map((volume) =>
    volumeOption(volume, volumes, codes, media),
  );
  const hints = options
    .map(noSpaceHint)
    .filter((hint): hint is string => hint !== null);
  return (
    <>
      <SheetHint>{CHOOSER_HINT}</SheetHint>
      <View style={styles.options}>
        {options.map((option) => (
          <VolumeOptionRow
            key={option.volumeUuid ?? option.name}
            option={option}
            disabled={pending}
            onChoose={onChoose}
          />
        ))}
      </View>
      {hints.map((hint) => (
        <SheetHint key={hint}>{hint}</SheetHint>
      ))}
      {options.length === SINGLE_VOLUME ? (
        <SheetHint>{NO_CARD_HINT}</SheetHint>
      ) : null}
    </>
  );
}

export interface ConfirmBodyProps {
  readonly volumes: DataFolderVolumes;
  readonly target: string | null;
  readonly media: MediaSize | null;
}

export function ConfirmBody({ volumes, target, media }: ConfirmBodyProps) {
  const current = volumes.currentVolumeUuid;
  const destination = findVolume(volumes, target);
  return (
    <>
      {media === null ? null : (
        <SheetRow label="Moves">
          <EditValue>{mediaText(media)}</EditValue>
        </SheetRow>
      )}
      <SheetRow label="From">
        <EditValue>
          {volumeName(findVolume(volumes, current), current)}
        </EditValue>
      </SheetRow>
      <SheetRow label="To">
        <EditValue>{volumeName(destination, target)}</EditValue>
      </SheetRow>
      {media === null || destination === undefined ? null : (
        <SheetRow label={freeAfterLabel(target)}>
          <EditValue>{freeAfterText(destination, media)}</EditValue>
        </SheetRow>
      )}
      {CONFIRM_HINTS.map((hint) => (
        <SheetHint key={hint}>{hint}</SheetHint>
      ))}
    </>
  );
}

function Count({ parts }: { readonly parts: readonly [string, string] }) {
  const styles = useStyles();
  const [done, total] = parts;
  return (
    <Text style={styles.number}>
      {`${done} `}
      <Text style={styles.of}>{total}</Text>
    </Text>
  );
}

export interface MovingBodyProps {
  readonly move: MoveStatus;
  readonly phases: MovePhases;
  readonly notice: string | null;
}

export function MovingBody({ move, phases, notice }: MovingBodyProps) {
  const styles = useStyles();
  return (
    <>
      <View style={styles.numbers}>
        <Count parts={progressBytes(move)} />
        <Count parts={progressFiles(move, phases)} />
      </View>
      <LinearProgress
        percent={movePercent(move)}
        accessibilityLabel={progressLabel(move)}
      />
      {notice === null ? null : <SheetHint>{notice}</SheetHint>}
      <SheetHint>{`${phaseText(move.phase, phases)} ${movingHint(move)}`}</SheetHint>
      <SheetHint>{MOVING_CLOSE_HINT}</SheetHint>
    </>
  );
}

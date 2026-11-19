import { Badge, dataFolder, Icon, rowLabel } from '@kitbag/core-design';
import { useCallback } from 'react';

import { IN_USE, type VolumeOption } from './dataFolderText.ts';
import { OptionRow } from './OptionRow.tsx';

export interface VolumeOptionRowProps {
  readonly option: VolumeOption;
  readonly disabled: boolean;
  readonly onChoose: (volumeUuid: string | null) => void;
}

export function VolumeOptionRow({
  option,
  disabled,
  onChoose,
}: VolumeOptionRowProps) {
  const choose = useCallback(() => {
    onChoose(option.volumeUuid);
  }, [onChoose, option.volumeUuid]);
  const trailing = option.inUse ? (
    <Badge tone="success" icon="check" label={IN_USE} />
  ) : option.offered ? (
    <Icon name="forward" size="control" color="decor" />
  ) : null;
  return (
    <OptionRow
      icon={option.volumeUuid === null ? 'internalStorage' : 'sdCard'}
      title={option.name}
      meta={option.sub}
      minHeight={dataFolder.volumeRowMinHeight}
      highlighted={option.inUse}
      dimmed={!option.inUse && !option.offered}
      trailing={trailing}
      accessibilityLabel={rowLabel(
        option.name,
        option.inUse ? `${option.sub}, ${IN_USE}` : option.sub,
      )}
      {...(option.offered ? { onPress: choose, disabled } : {})}
    />
  );
}

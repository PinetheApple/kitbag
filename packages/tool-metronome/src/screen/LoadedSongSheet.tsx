import { Button, Sheet } from '@kitbag/core-design';
import { useLibrary } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Text } from 'react-native';

import { NOT_IN_SETLIST } from '../logic/setlistChip.ts';
import { useSheetStyles } from './sheetStyles.ts';

export interface LoadedSongSheetProps {
  readonly visible: boolean;
  readonly song: string;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
  readonly onOpenSetlists: (() => void) | undefined;
}

export function LoadedSongSheet({
  visible,
  song,
  bottomInset,
  onDismiss,
  onOpenSetlists,
}: LoadedSongSheetProps) {
  const sheetStyles = useSheetStyles();
  const clearSong = useLibrary((s) => s.clearSong);
  const handleClear = useCallback(() => {
    onDismiss();
    clearSong();
  }, [onDismiss, clearSong]);
  const handleOpenSetlists = useCallback(() => {
    onDismiss();
    onOpenSetlists?.();
  }, [onDismiss, onOpenSetlists]);
  return (
    <Sheet
      visible={visible}
      title={song}
      titleSize="large"
      dismissLabel="Close song"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <Text style={sheetStyles.songHint}>{NOT_IN_SETLIST}</Text>
      <Button
        variant="ghost"
        size="target"
        icon="close"
        iconSize="caret"
        label="Clear song"
        onPress={handleClear}
      />
      {onOpenSetlists === undefined ? null : (
        <Button
          variant="ghost"
          size="target"
          icon="setlist"
          iconSize="caret"
          label="Open setlists"
          onPress={handleOpenSetlists}
        />
      )}
    </Sheet>
  );
}

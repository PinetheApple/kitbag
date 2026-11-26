import { Icon, ListRow, Sheet, useTheme } from '@kitbag/core-design';
import type { MediaSessionSnapshot } from '@kitbag/core-native';
import { useCallback } from 'react';
import { View } from 'react-native';

import { sourceRows, type SourceRow } from '../logic/sourceRows.ts';

const SHEET_HINT =
  'Playing music comes first. Podcasts and audiobooks are never followed unless you pick them.';

interface SourceRowViewProps {
  readonly row: SourceRow;
  readonly onPick: (sessionId: string) => void;
}

function SourceRowView({ row, onPick }: SourceRowViewProps) {
  const theme = useTheme();
  const pick = useCallback(() => {
    onPick(row.sessionId);
  }, [onPick, row.sessionId]);
  return (
    <ListRow
      icon={row.icon}
      title={row.appLabel}
      subtitle={row.detail}
      liveDot={row.live}
      active={row.followed}
      trailing={
        row.followed ? (
          <Icon name="check" size="action" color={theme.accentInk} />
        ) : (
          <View />
        )
      }
      onPress={pick}
    />
  );
}

export interface SourceSheetProps {
  readonly visible: boolean;
  readonly sessions: readonly MediaSessionSnapshot[];
  readonly followedId: string | undefined;
  readonly bottomInset: number;
  readonly onPick: (sessionId: string) => void;
  readonly onDismiss: () => void;
}

export function SourceSheet({
  visible,
  sessions,
  followedId,
  bottomInset,
  onPick,
  onDismiss,
}: SourceSheetProps) {
  return (
    <Sheet
      visible={visible}
      title="Source"
      hint={SHEET_HINT}
      dismissLabel="Close the source picker"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      {sourceRows(sessions, followedId).map((row) => (
        <SourceRowView key={row.sessionId} row={row} onPick={onPick} />
      ))}
    </Sheet>
  );
}

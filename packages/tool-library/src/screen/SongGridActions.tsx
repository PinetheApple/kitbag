import {
  Button,
  createThemedStyles,
  lineRatio,
  minTouchTargetDp,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { useSongPlayer, useSongViewing } from '@kitbag/core-state';
import { Text, View } from 'react-native';

import type { ClickGroup } from '../logic/clickChipText.ts';
import { isNoGridBadge, lockBadgeOf } from '../logic/lockText.ts';
import { SET_TEMPO_TEXT } from '../logic/manualTempoText.ts';
import { SongClickChips } from './SongClickChips.tsx';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sectionGap,
    minHeight: minTouchTargetDp,
  },
  why: {
    ...textStyle(textRoles.rowSubtitle),
    lineHeight: textRoles.rowSubtitle.size * lineRatio.hint,
    flex: 1,
    minWidth: 0,
    color: theme.color.text2,
  },
}));

function SetTempoEntry({ onPress }: { readonly onPress: () => void }) {
  const styles = useStyles();
  const viewing = useSongViewing();
  return (
    <View style={styles.row}>
      <Button
        label={SET_TEMPO_TEXT.title}
        icon="metronome"
        iconSize="sheetButton"
        variant="accentTonal"
        size="target"
        disabled={viewing}
        disabledLook="faded"
        onPress={onPress}
      />
      <Text style={styles.why}>{SET_TEMPO_TEXT.entryReason}</Text>
    </View>
  );
}

export interface SongGridActionsProps {
  readonly onOpenClick: (group: ClickGroup) => void;
  readonly onSetTempo: () => void;
}

export function SongGridActions({
  onOpenClick,
  onSetTempo,
}: SongGridActionsProps) {
  const noGrid = isNoGridBadge(useSongPlayer(lockBadgeOf));
  return noGrid ? (
    <SetTempoEntry onPress={onSetTempo} />
  ) : (
    <SongClickChips onOpen={onOpenClick} />
  );
}

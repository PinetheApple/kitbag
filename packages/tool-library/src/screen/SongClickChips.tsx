import {
  Chip,
  ChipRow,
  createThemedStyles,
  UnsavedDot,
} from '@kitbag/core-design';
import {
  customSoundViews,
  useClickSounds,
  useSongPlayer,
} from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';

import {
  clickChips,
  SONG_CLICK_TEXT,
  type ClickChip,
  type ClickGroup,
} from '../logic/clickChipText.ts';
import { lockBadgeOf } from '../logic/lockText.ts';

const useStyles = createThemedStyles(() => ({
  dot: { alignSelf: 'center' },
}));

interface SongClickChipProps {
  readonly chip: ClickChip;
  readonly enabled: boolean;
  readonly onOpen: (group: ClickGroup) => void;
}

function SongClickChip({ chip, enabled, onOpen }: SongClickChipProps) {
  const handlePress = useCallback(() => {
    onOpen(chip.group);
  }, [onOpen, chip.group]);
  return (
    <Chip
      label={chip.label}
      active={chip.active}
      muted={chip.muted}
      accessibilityLabel={chip.spoken}
      disabled={!enabled}
      onPress={handlePress}
    />
  );
}

export function SongClickChips({
  onOpen,
}: {
  readonly onOpen: (group: ClickGroup) => void;
}) {
  const styles = useStyles();
  const settings = useSongPlayer((s) => s.clickSettings);
  const hasGrid = useSongPlayer(lockBadgeOf) === 'grid';
  const sounds = useClickSounds((s) => s.sounds);
  const unavailable = useClickSounds((s) => s.unavailable);
  const custom = useMemo(
    () => customSoundViews(sounds, unavailable),
    [sounds, unavailable],
  );
  return (
    <ChipRow>
      {clickChips(settings, custom, hasGrid).map((chip) => (
        <SongClickChip
          key={chip.group}
          chip={chip}
          enabled={hasGrid}
          onOpen={onOpen}
        />
      ))}
      {settings.dirty ? (
        <View
          accessible
          accessibilityLabel={SONG_CLICK_TEXT.unsaved}
          style={styles.dot}
        >
          <UnsavedDot />
        </View>
      ) : null}
    </ChipRow>
  );
}

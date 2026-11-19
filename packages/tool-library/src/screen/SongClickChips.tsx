import {
  Chip,
  ChipRow,
  createThemedStyles,
  metronome,
  opacity,
} from '@kitbag/core-design';
import {
  useClickSounds,
  useSongPlayer,
  type ClickSoundStore,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { View } from 'react-native';

import {
  clickChips,
  SONG_CLICK_TEXT,
  type ClickChip,
  type ClickGroup,
} from '../logic/clickChipText.ts';
import { lockBadgeOf } from '../logic/lockText.ts';

const useStyles = createThemedStyles((theme) => ({
  muted: { opacity: opacity.muted },
  dot: {
    alignSelf: 'center',
    width: metronome.unsavedDot,
    height: metronome.unsavedDot,
    borderRadius: metronome.unsavedDot / 2,
    backgroundColor: theme.color[theme.accentInk],
  },
}));

const customSoundsOf = (state: ClickSoundStore) => state.sounds;

interface SongClickChipProps {
  readonly chip: ClickChip;
  readonly enabled: boolean;
  readonly onOpen: (group: ClickGroup) => void;
}

function SongClickChip({ chip, enabled, onOpen }: SongClickChipProps) {
  const styles = useStyles();
  const handlePress = useCallback(() => {
    onOpen(chip.group);
  }, [onOpen, chip.group]);
  const face = (
    <Chip
      label={chip.label}
      active={chip.active}
      accessibilityLabel={chip.spoken}
      disabled={!enabled}
      onPress={handlePress}
    />
  );
  return chip.muted ? <View style={styles.muted}>{face}</View> : face;
}

export function SongClickChips({
  onOpen,
}: {
  readonly onOpen: (group: ClickGroup) => void;
}) {
  const styles = useStyles();
  const settings = useSongPlayer((s) => s.clickSettings);
  const hasGrid = useSongPlayer(lockBadgeOf) === 'grid';
  const custom = useClickSounds(customSoundsOf);
  return (
    <ChipRow>
      {clickChips(settings, custom).map((chip) => (
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
        />
      ) : null}
    </ChipRow>
  );
}

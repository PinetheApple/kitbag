import {
  createThemedStyles,
  ScreenAppBar,
  textRoles,
  textStyle,
  type ScreenBarAction,
} from '@kitbag/core-design';
import { useStemPlayer } from '@kitbag/core-state';
import { useMemo } from 'react';
import { Text } from 'react-native';

const useStyles = createThemedStyles((theme) => ({
  title: { ...textStyle(textRoles.songTitle), color: theme.color.text },
  artist: { ...textStyle(textRoles.songArtist), color: theme.color.text2 },
}));

interface StemAppBarProps {
  readonly onBack: () => void;
  readonly onMenu: (() => void) | null;
}

export function StemAppBar({ onBack, onMenu }: StemAppBarProps) {
  const styles = useStyles();
  const title = useStemPlayer((s) => s.title);
  const artist = useStemPlayer((s) => s.artist);
  const actions: readonly ScreenBarAction[] = useMemo(
    () =>
      onMenu === null
        ? []
        : [{ icon: 'more', label: 'Player menu', onPress: onMenu }],
    [onMenu],
  );
  return (
    <ScreenAppBar onBack={onBack} actions={actions}>
      <Text style={styles.title} numberOfLines={1}>
        {title === '' ? 'Stems' : title}
      </Text>
      {artist === null ? null : (
        <Text style={styles.artist} numberOfLines={1}>
          {artist}
        </Text>
      )}
    </ScreenAppBar>
  );
}

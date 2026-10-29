import {
  createThemedStyles,
  Icon,
  stemPlayer,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { useStemPlayer } from '@kitbag/core-state';
import { Pressable, Text, View } from 'react-native';

const useStyles = createThemedStyles((theme) => ({
  bar: {
    minHeight: stemPlayer.appBarHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.appBarGap,
    paddingHorizontal: stemPlayer.appBarH,
  },
  button: {
    width: stemPlayer.iconButton,
    height: stemPlayer.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { flex: 1, minWidth: 0 },
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
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.button}
        onPress={onBack}
      >
        <Icon name="arrowBack" size="bar" color="text" />
      </Pressable>
      <View style={styles.heading} accessibilityRole="header" accessible>
        <Text style={styles.title} numberOfLines={1}>
          {title === '' ? 'Stems' : title}
        </Text>
        {artist === null ? null : (
          <Text style={styles.artist} numberOfLines={1}>
            {artist}
          </Text>
        )}
      </View>
      {onMenu === null ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Player menu"
          style={styles.button}
          onPress={onMenu}
        >
          <Icon name="more" size="bar" color="text2" />
        </Pressable>
      )}
    </View>
  );
}

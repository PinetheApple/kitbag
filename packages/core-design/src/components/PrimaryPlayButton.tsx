import { Pressable, View } from 'react-native';

import { playGlyphPath, radius, size } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

export type PlayGlyph = 'play' | 'stop';

const UNIT = size.playGlyphBox / playGlyphPath.viewBox;
const GLYPH_WIDTH = playGlyphPath.width * UNIT;
const GLYPH_HEIGHT = playGlyphPath.height * UNIT;
const TRANSPARENT = 'transparent';

export interface PrimaryPlayButtonProps {
  readonly glyph: PlayGlyph;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
}

const useStyles = createThemedStyles((theme) => ({
  button: {
    width: size.playButton,
    height: size.playButton,
    borderRadius: radius.circle,
    backgroundColor: theme.color.accent,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: theme.shadow,
  },
  glyphBox: {
    width: size.playGlyphBox,
    height: size.playGlyphBox,
  },
  play: {
    position: 'absolute',
    left: playGlyphPath.left * UNIT,
    top: playGlyphPath.top * UNIT,
    width: 0,
    height: 0,
    borderLeftWidth: GLYPH_WIDTH,
    borderTopWidth: GLYPH_HEIGHT / 2,
    borderBottomWidth: GLYPH_HEIGHT / 2,
    borderLeftColor: theme.color.onAccent,
    borderTopColor: TRANSPARENT,
    borderBottomColor: TRANSPARENT,
  },
  stop: {
    position: 'absolute',
    left: (size.playGlyphBox - GLYPH_HEIGHT) / 2,
    top: playGlyphPath.top * UNIT,
    width: GLYPH_HEIGHT,
    height: GLYPH_HEIGHT,
    backgroundColor: theme.color.onAccent,
  },
}));

export function PrimaryPlayButton({
  glyph,
  accessibilityLabel,
  onPress,
}: PrimaryPlayButtonProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={styles.button}
      onPress={onPress}
    >
      <View style={styles.glyphBox}>
        <View style={glyph === 'play' ? styles.play : styles.stop} />
      </View>
    </Pressable>
  );
}

import { Pressable, View } from 'react-native';

import { playGlyphPath, playGlyphPathLarge, radius, size } from '../roles.ts';
import { TRANSPARENT } from '../styleConstants.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

export type PlayGlyph = 'play' | 'stop';
export type PlayButtonSize = 'default' | 'large';

const UNIT = size.playGlyphBox / playGlyphPath.viewBox;
const GLYPH_WIDTH = playGlyphPath.width * UNIT;
const GLYPH_HEIGHT = playGlyphPath.height * UNIT;

const LARGE_UNIT = size.playGlyphBoxLarge / playGlyphPathLarge.viewBox;
const LARGE_GLYPH_WIDTH = playGlyphPathLarge.width * LARGE_UNIT;
const LARGE_GLYPH_HEIGHT = playGlyphPathLarge.height * LARGE_UNIT;
const LARGE_STOP_SIDE =
  size.playGlyphBoxLarge - 2 * playGlyphPathLarge.stopInset * LARGE_UNIT;

export interface PrimaryPlayButtonProps {
  readonly glyph: PlayGlyph;
  readonly accessibilityLabel: string;
  readonly onPress: () => void;
  readonly size?: PlayButtonSize;
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
  buttonLarge: {
    width: size.playButtonLarge,
    height: size.playButtonLarge,
  },
  glyphBoxLarge: {
    width: size.playGlyphBoxLarge,
    height: size.playGlyphBoxLarge,
  },
  playLarge: {
    position: 'absolute',
    left: playGlyphPathLarge.left * LARGE_UNIT,
    top: playGlyphPathLarge.top * LARGE_UNIT,
    width: 0,
    height: 0,
    borderLeftWidth: LARGE_GLYPH_WIDTH,
    borderTopWidth: LARGE_GLYPH_HEIGHT / 2,
    borderBottomWidth: LARGE_GLYPH_HEIGHT / 2,
    borderLeftColor: theme.color.onAccent,
    borderTopColor: TRANSPARENT,
    borderBottomColor: TRANSPARENT,
  },
  stopLarge: {
    position: 'absolute',
    left: playGlyphPathLarge.stopInset * LARGE_UNIT,
    top: playGlyphPathLarge.stopInset * LARGE_UNIT,
    width: LARGE_STOP_SIDE,
    height: LARGE_STOP_SIDE,
    backgroundColor: theme.color.onAccent,
  },
}));

export function PrimaryPlayButton({
  glyph,
  accessibilityLabel,
  onPress,
  size: buttonSize = 'default',
}: PrimaryPlayButtonProps) {
  const styles = useStyles();
  const large = buttonSize === 'large';
  const playStyle = large ? styles.playLarge : styles.play;
  const stopStyle = large ? styles.stopLarge : styles.stop;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.button, large && styles.buttonLarge]}
      onPress={onPress}
    >
      <View style={large ? styles.glyphBoxLarge : styles.glyphBox}>
        <View style={glyph === 'play' ? playStyle : stopStyle} />
      </View>
    </Pressable>
  );
}

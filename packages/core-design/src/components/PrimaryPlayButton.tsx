import { Pressable, View, type ViewStyle } from 'react-native';

import { playGlyphPath, playGlyphPathLarge, radius, size } from '../roles.ts';
import { TRANSPARENT } from '../styleConstants.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

export type PlayGlyph = 'play' | 'stop';
export type PlayButtonSize = 'default' | 'large';

const UNIT = size.playGlyphBox / playGlyphPath.viewBox;
const GLYPH_HEIGHT = playGlyphPath.height * UNIT;

const LARGE_UNIT = size.playGlyphBoxLarge / playGlyphPathLarge.viewBox;
const LARGE_STOP_INSET = playGlyphPathLarge.stopInset * LARGE_UNIT;
const LARGE_STOP_SIDE = size.playGlyphBoxLarge - 2 * LARGE_STOP_INSET;

interface GlyphPath {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

function playTriangle(path: GlyphPath, unit: number, ink: string): ViewStyle {
  const height = path.height * unit;
  return {
    position: 'absolute',
    left: path.left * unit,
    top: path.top * unit,
    width: 0,
    height: 0,
    borderLeftWidth: path.width * unit,
    borderTopWidth: height / 2,
    borderBottomWidth: height / 2,
    borderLeftColor: ink,
    borderTopColor: TRANSPARENT,
    borderBottomColor: TRANSPARENT,
  };
}

function stopSquare(
  left: number,
  top: number,
  side: number,
  ink: string,
): ViewStyle {
  return {
    position: 'absolute',
    left,
    top,
    width: side,
    height: side,
    backgroundColor: ink,
  };
}

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
  play: playTriangle(playGlyphPath, UNIT, theme.color.onAccent),
  stop: stopSquare(
    (size.playGlyphBox - GLYPH_HEIGHT) / 2,
    playGlyphPath.top * UNIT,
    GLYPH_HEIGHT,
    theme.color.onAccent,
  ),
  buttonLarge: {
    width: size.playButtonLarge,
    height: size.playButtonLarge,
  },
  glyphBoxLarge: {
    width: size.playGlyphBoxLarge,
    height: size.playGlyphBoxLarge,
  },
  playLarge: playTriangle(playGlyphPathLarge, LARGE_UNIT, theme.color.onAccent),
  stopLarge: stopSquare(
    LARGE_STOP_INSET,
    LARGE_STOP_INSET,
    LARGE_STOP_SIDE,
    theme.color.onAccent,
  ),
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

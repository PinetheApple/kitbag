import { useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import {
  iconSizes,
  pauseGlyphPath,
  playGlyphPath,
  playGlyphPathLarge,
  radius,
  size,
} from '../roles.ts';
import { stemPlayer } from '../stemPlayerRoles.ts';
import { TRANSPARENT } from '../styleConstants.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import type { TransportKeySize } from './TransportKey.tsx';

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
  dockButton: {
    width: stemPlayer.playButton,
    height: stemPlayer.playButton,
  },
  dockGlyphBox: {
    transform: [{ scale: iconSizes.dockPlay / size.playGlyphBox }],
  },
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  pauseBar: {
    position: 'absolute',
    top: pauseGlyphPath.top * UNIT,
    width: pauseGlyphPath.barWidth * UNIT,
    height: pauseGlyphPath.height * UNIT,
    backgroundColor: theme.color.onAccent,
  },
  pauseLeft: { left: pauseGlyphPath.left * UNIT },
  pauseRight: {
    left:
      (pauseGlyphPath.left + pauseGlyphPath.barWidth + pauseGlyphPath.barGap) *
      UNIT,
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

export interface PlayPauseButtonProps {
  readonly playing: SharedValue<number>;
  readonly playLabel: string;
  readonly pauseLabel: string;
  readonly onPress: () => void;
  readonly size?: TransportKeySize;
}

// The glyph follows the engine's playing flag on the UI thread; only the
// spoken label, which changes on a press or at the song's end, renders.
export function PlayPauseButton({
  playing,
  playLabel,
  pauseLabel,
  onPress,
  size: buttonSize = 'standard',
}: PlayPauseButtonProps) {
  const styles = useStyles();
  const dock = buttonSize === 'dock';
  const [isPlaying, setIsPlaying] = useState(false);
  useAnimatedReaction(
    () => playing.value !== 0,
    (now, before) => {
      if (now !== before) scheduleOnRN(setIsPlaying, now);
    },
  );
  const playStyle = useAnimatedStyle(() => ({
    opacity: playing.value === 0 ? 1 : 0,
  }));
  const pauseStyle = useAnimatedStyle(() => ({
    opacity: playing.value === 0 ? 0 : 1,
  }));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? pauseLabel : playLabel}
      style={[styles.button, dock && styles.dockButton]}
      onPress={onPress}
    >
      <View style={[styles.glyphBox, dock && styles.dockGlyphBox]}>
        <Animated.View style={[styles.layer, playStyle]}>
          <View style={styles.play} />
        </Animated.View>
        <Animated.View style={[styles.layer, pauseStyle]}>
          <View style={[styles.pauseBar, styles.pauseLeft]} />
          <View style={[styles.pauseBar, styles.pauseRight]} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

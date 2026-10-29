import { useState } from 'react';
import { Pressable, View } from 'react-native';
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
  radius,
  size,
} from '../roles.ts';
import { stemPlayer } from '../stemPlayerRoles.ts';
import { TRANSPARENT } from '../styleConstants.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import type { TransportKeySize } from './TransportKey.tsx';

export type PlayGlyph = 'play' | 'stop';

const UNIT = size.playGlyphBox / playGlyphPath.viewBox;
const GLYPH_WIDTH = playGlyphPath.width * UNIT;
const GLYPH_HEIGHT = playGlyphPath.height * UNIT;

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
  dockButton: {
    width: stemPlayer.playButton,
    height: stemPlayer.playButton,
  },
  dockGlyphBox: {
    transform: [{ scale: iconSizes.dockPlay / size.playGlyphBox }],
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

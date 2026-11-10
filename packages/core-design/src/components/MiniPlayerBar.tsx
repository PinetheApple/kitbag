import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

import { clampUnit } from '../clampUnit.ts';
import { size } from '../roles.ts';
import { miniPlayer, miniPlayerText } from '../stemPlayerRoles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { EllipsizedText } from './EllipsizedText.tsx';
import { Icon } from './Icon.tsx';
import { usePlayPauseLayers } from './PrimaryPlayButton.tsx';

const useStyles = createThemedStyles((theme) => ({
  bar: {
    backgroundColor: theme.color.surface1,
    borderTopWidth: size.stroke,
    borderColor: theme.color.line,
    boxShadow: theme.shadow,
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: miniPlayer.progressTop,
    height: miniPlayer.progress,
    backgroundColor: theme.color.line,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    transformOrigin: 'left',
    backgroundColor: theme.color.accent,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: miniPlayer.height,
    gap: miniPlayer.gap,
    paddingLeft: miniPlayer.start,
    paddingRight: miniPlayer.end,
  },
  open: {
    flex: 1,
    minWidth: 0,
    minHeight: miniPlayer.height,
    flexDirection: 'row',
    alignItems: 'center',
    gap: miniPlayer.gap,
  },
  tile: {
    width: miniPlayer.tile,
    height: miniPlayer.tile,
    borderRadius: miniPlayer.tileRadius,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0 },
  title: { ...textStyle(miniPlayerText.title), color: theme.color.text },
  detail: { ...textStyle(miniPlayerText.detail), color: theme.color.text2 },
  button: {
    width: minTouchTargetDp,
    height: minTouchTargetDp,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

export interface MiniPlayerBarProps {
  readonly title: string;
  readonly detail: string;
  readonly progress: SharedValue<number>;
  readonly playing: SharedValue<number>;
  readonly openLabel: string;
  readonly playLabel: string;
  readonly pauseLabel: string;
  readonly closeLabel: string;
  readonly bottomInset: number;
  readonly onOpen: () => void;
  readonly onTogglePlay: () => void;
  readonly onClose: () => void;
}

type PlayToggleProps = Pick<
  MiniPlayerBarProps,
  'playing' | 'playLabel' | 'pauseLabel'
> & { readonly onPress: () => void };

function PlayToggle({
  playing,
  playLabel,
  pauseLabel,
  onPress,
}: PlayToggleProps) {
  const styles = useStyles();
  const { isPlaying, playStyle, pauseStyle } = usePlayPauseLayers(playing);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? pauseLabel : playLabel}
      style={styles.button}
      onPress={onPress}
    >
      <Animated.View style={[styles.layer, playStyle]}>
        <Icon name="play" size="miniPlay" color="text" />
      </Animated.View>
      <Animated.View style={[styles.layer, pauseStyle]}>
        <Icon name="pause" size="miniPlay" color="text" />
      </Animated.View>
    </Pressable>
  );
}

export function MiniPlayerBar({
  title,
  detail,
  progress,
  playing,
  openLabel,
  playLabel,
  pauseLabel,
  closeLabel,
  bottomInset,
  onOpen,
  onTogglePlay,
  onClose,
}: MiniPlayerBarProps) {
  const styles = useStyles();
  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: clampUnit(progress.value) }],
  }));
  const inset = useMemo(() => ({ paddingBottom: bottomInset }), [bottomInset]);
  return (
    <View style={[styles.bar, inset]}>
      <View
        style={styles.track}
        importantForAccessibility="no-hide-descendants"
      >
        <Animated.View style={[styles.fill, fillStyle]} />
      </View>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={openLabel}
          style={styles.open}
          onPress={onOpen}
        >
          <View style={styles.tile}>
            <Icon name="song" size="miniTile" color="text" />
          </View>
          <View style={styles.text}>
            <EllipsizedText style={styles.title}>{title}</EllipsizedText>
            <EllipsizedText style={styles.detail}>{detail}</EllipsizedText>
          </View>
        </Pressable>
        <PlayToggle
          playing={playing}
          playLabel={playLabel}
          pauseLabel={pauseLabel}
          onPress={onTogglePlay}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
          style={styles.button}
          onPress={onClose}
        >
          <Icon name="close" size="bar" color="text2" />
        </Pressable>
      </View>
    </View>
  );
}

import {
  Button,
  createThemedStyles,
  Icon,
  metronome,
  palette,
  radius,
  space,
  textRoles,
  textStyle,
  withAlpha,
} from '@kitbag/core-design';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

// The scrim stays dark on Daylight too, so it takes Stage's background.
const SCRIM = withAlpha(palette.bg.dark, metronome.coachScrim);

const useStyles = createThemedStyles((theme) => ({
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    paddingHorizontal: space.screenInset,
    backgroundColor: SCRIM,
  },
  ring: {
    width: metronome.coachRingWidth,
    maxWidth: '100%',
    height: metronome.coachRingHeight,
    borderRadius: metronome.coachRingRadius,
    borderWidth: metronome.coachRingBorder,
    borderStyle: 'dashed',
    borderColor: theme.color.onAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    width: metronome.coachBubbleWidth,
    maxWidth: '100%',
    marginTop: metronome.coachBubbleGap,
    paddingVertical: metronome.coachBubbleV,
    paddingHorizontal: metronome.coachBubbleH,
    gap: space.rowGap,
    borderRadius: radius.card,
    backgroundColor: theme.color.surface1,
    boxShadow: theme.shadow,
  },
  title: {
    ...textStyle(textRoles.coachTitle),
    color: theme.color.text,
  },
  body: {
    ...textStyle(textRoles.coachBody),
    color: theme.color.text2,
  },
  action: {
    alignSelf: 'flex-end',
  },
}));

interface SwipeHintProps {
  readonly zoneTop: number;
  readonly zoneHeight: number;
  readonly onDismiss: () => void;
}

export function SwipeHint({ zoneTop, zoneHeight, onDismiss }: SwipeHintProps) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const ringTop = useMemo(
    () => ({
      paddingTop: Math.max(
        0,
        zoneTop + (zoneHeight - metronome.coachRingHeight) / 2,
      ),
    }),
    [zoneTop, zoneHeight],
  );
  return (
    <Animated.View
      {...(reduceMotion ? {} : { entering: FadeIn })}
      accessibilityViewIsModal
      style={[styles.scrim, ringTop]}
    >
      <View style={styles.ring} importantForAccessibility="no-hide-descendants">
        <Icon name="swipeTempo" size="coachRing" color="onAccent" />
      </View>
      <View style={styles.bubble}>
        <Text style={styles.title} accessibilityRole="header">
          Swipe up or down anywhere here
        </Text>
        <Text style={styles.body}>
          Changes tempo by 1 BPM per step; flick for bigger jumps. Tap the
          number to type a tempo.
        </Text>
        <View style={styles.action}>
          <Button
            size="prompt"
            label="Got it"
            variant="primary"
            onPress={onDismiss}
          />
        </View>
      </View>
    </Animated.View>
  );
}

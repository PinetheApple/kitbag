import {
  Button,
  createThemedStyles,
  focusReaderOn,
  IconGlyph,
  iconSizes,
  inkOnScrim,
  metronome,
  onHardwareBack,
  palette,
  radius,
  space,
  textRoles,
  textStyle,
  useReduceMotionMode,
  withAlpha,
  WindowOverlay,
  type WindowOverlayProps,
} from '@kitbag/core-design';
import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { FadeIn } from 'react-native-reanimated';

const SCRIM = withAlpha(palette.bg.dark, metronome.coachScrim);

const useStyles = createThemedStyles((theme) => ({
  column: {
    alignItems: 'center',
    paddingHorizontal: space.screenInset,
  },
  ring: {
    width: metronome.coachRingWidth,
    maxWidth: '100%',
    height: metronome.coachRingHeight,
    borderRadius: metronome.coachRingRadius,
    borderWidth: metronome.coachRingBorder,
    borderStyle: 'dashed',
    borderColor: inkOnScrim,
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
  readonly gesture: NonNullable<WindowOverlayProps['gesture']>;
  readonly onDismiss: () => void;
}

export function SwipeHint({
  zoneTop,
  zoneHeight,
  gesture,
  onDismiss,
}: SwipeHintProps) {
  const styles = useStyles();
  const motion = useReduceMotionMode();
  const entering = useMemo(() => FadeIn.reduceMotion(motion), [motion]);
  useEffect(() => onHardwareBack(onDismiss), [onDismiss]);
  const ringHeight = Math.min(metronome.coachRingHeight, zoneHeight);
  const column = useMemo(
    () => [
      styles.column,
      { paddingTop: Math.max(0, zoneTop + (zoneHeight - ringHeight) / 2) },
    ],
    [styles.column, zoneTop, zoneHeight, ringHeight],
  );
  const ring = useMemo(
    () => [styles.ring, { height: ringHeight }],
    [styles.ring, ringHeight],
  );
  return (
    <WindowOverlay
      scrim={SCRIM}
      entering={entering}
      gesture={gesture}
      style={column}
    >
      <View style={ring} importantForAccessibility="no-hide-descendants">
        <IconGlyph
          name="swipeTempo"
          px={iconSizes.coachRing}
          color={inkOnScrim}
        />
      </View>
      <View style={styles.bubble}>
        <Text
          ref={focusReaderOn}
          style={styles.title}
          accessibilityRole="header"
        >
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
    </WindowOverlay>
  );
}

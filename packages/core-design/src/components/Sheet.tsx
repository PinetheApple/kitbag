import { useCallback, useEffect, useId, useMemo, type ReactNode } from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { IconName } from '../icons.ts';
import { opacity, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { withAlpha } from '../theme.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import {
  SHEET_DRAG_ACTIVATION_DP,
  shouldDismissSheet,
} from '../sheetDismiss.ts';
import { palette, radii } from '../tokens.ts';
import { useReduceMotionMode } from '../useReduceMotion.ts';
import { InlineIcon } from './IconGlyph.tsx';
import { useSheetPortal } from './SheetHost.tsx';

// A scroll view drops every touch outside its frame, so the frame reaches this
// far into the sheet's padding. The right side stays put: the indicator is there.
export const SHEET_TOUCH_ROOM = space.sectionGap;
const INDICATOR_INSETS = { top: SHEET_TOUCH_ROOM, bottom: SHEET_TOUCH_ROOM };
const SCRIM = withAlpha(palette.bg.dark, opacity.sheetScrim);

const useStyles = createThemedStyles((theme) => ({
  frame: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    flexShrink: 1,
    backgroundColor: theme.color.surface1,
    borderTopLeftRadius: radii.sheetTop,
    borderTopRightRadius: radii.sheetTop,
    borderBottomLeftRadius: radii.sheetBottom,
    borderBottomRightRadius: radii.sheetBottom,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    paddingTop: space.cardPadding,
    paddingHorizontal: space.cardPadding,
    gap: space.sectionGap,
    boxShadow: theme.shadow,
  },
  header: {
    gap: space.sectionGap,
  },
  grab: {
    width: size.grabWidth,
    height: size.grabHeight,
    borderRadius: size.grabHeight / 2,
    backgroundColor: theme.color.surface3,
    alignSelf: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.chipGap,
  },
  title: {
    ...textStyle(textRoles.sheetTitle),
    color: theme.color.text,
  },
  titleLarge: textStyle(textRoles.sheetTitleLarge),
  scroll: {
    flexGrow: 0,
    marginVertical: -SHEET_TOUCH_ROOM,
    marginLeft: -SHEET_TOUCH_ROOM,
  },
  content: {
    gap: space.sectionGap,
    paddingVertical: SHEET_TOUCH_ROOM,
    paddingLeft: SHEET_TOUCH_ROOM,
  },
  hint: {
    ...textStyle(textRoles.hint),
    color: theme.color.text3,
  },
  centered: {
    textAlign: 'center',
  },
  hintLarge: textStyle(textRoles.sheetHint),
  scrim: {
    backgroundColor: SCRIM,
  },
}));

export type SheetHintSize = 'default' | 'large';
export type SheetTitleSize = 'default' | 'large';

export interface SheetHintProps {
  readonly centered?: boolean;
  readonly size?: SheetHintSize;
  readonly children: ReactNode;
}

export function SheetHint({
  centered = false,
  size: hintSize = 'default',
  children,
}: SheetHintProps) {
  const styles = useStyles();
  return (
    <Text
      style={[
        styles.hint,
        hintSize === 'large' && styles.hintLarge,
        centered && styles.centered,
      ]}
    >
      {children}
    </Text>
  );
}

export interface SheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly titleSize?: SheetTitleSize;
  readonly titleIcon?: IconName;
  readonly hint?: string;
  readonly dismissLabel: string;
  readonly bottomInset?: number;
  readonly onDismiss: () => void;
  readonly onShow?: () => void;
  readonly dim?: boolean;
  readonly children: ReactNode;
}

export function Sheet({
  visible,
  title,
  titleSize = 'default',
  titleIcon,
  hint,
  dismissLabel,
  bottomInset = 0,
  onDismiss,
  onShow,
  dim = false,
  children,
}: SheetProps) {
  const styles = useStyles();
  const titleStyle = [styles.title, titleSize === 'large' && styles.titleLarge];
  const motion = useReduceMotionMode();
  const transitions = useMemo(
    () => ({
      scrimIn: FadeIn.reduceMotion(motion),
      scrimOut: FadeOut.reduceMotion(motion),
      sheetIn: SlideInDown.reduceMotion(motion),
      sheetOut: SlideOutDown.reduceMotion(motion),
    }),
    [motion],
  );
  const dragY = useSharedValue(0);
  const sheetHeight = useSharedValue(0);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      sheetHeight.value = event.nativeEvent.layout.height;
    },
    [sheetHeight],
  );

  const dragToDismiss = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(SHEET_DRAG_ACTIVATION_DP)
        .onUpdate((event) => {
          dragY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          if (shouldDismissSheet(event.translationY, sheetHeight.value)) {
            scheduleOnRN(onDismiss);
            return;
          }
          dragY.value = withSpring(0, { reduceMotion: motion });
        }),
    [dragY, sheetHeight, onDismiss, motion],
  );

  // Edge to edge, nothing resizes for the keyboard and RN's keyboard events
  // only fire on a layout pass (#142). Height is negative while it is open.
  const keyboard = useReanimatedKeyboardAnimation();
  const sheetStyle = useAnimatedStyle(() => ({
    paddingBottom:
      space.cardPadding + Math.max(bottomInset, -keyboard.height.value),
    transform: [{ translateY: dragY.value }],
  }));

  const { show, hide } = useSheetPortal();
  const id = useId();

  useEffect(() => {
    if (!visible) return undefined;
    dragY.value = 0;
    onShow?.();
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      onDismiss();
      return true;
    });
    return () => {
      back.remove();
    };
    // onShow and onDismiss run per opening, not per new callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const content = visible ? (
    <View style={styles.frame}>
      <Animated.View
        entering={transitions.scrimIn}
        exiting={transitions.scrimOut}
        style={[StyleSheet.absoluteFill, dim && styles.scrim]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          onPress={onDismiss}
        />
      </Animated.View>
      <Animated.View
        entering={transitions.sheetIn}
        exiting={transitions.sheetOut}
        style={[styles.sheet, sheetStyle]}
        onLayout={handleLayout}
      >
        <GestureDetector gesture={dragToDismiss}>
          <View style={styles.header}>
            <View style={styles.grab} />
            <View style={styles.titleRow}>
              {titleIcon === undefined ? null : (
                <InlineIcon name={titleIcon} style={titleStyle} />
              )}
              <Text accessibilityRole="header" style={titleStyle}>
                {title}
              </Text>
            </View>
          </View>
        </GestureDetector>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          bounces={false}
          keyboardShouldPersistTaps="handled"
          scrollIndicatorInsets={INDICATOR_INSETS}
        >
          {children}
          {hint === undefined ? null : <SheetHint>{hint}</SheetHint>}
        </ScrollView>
      </Animated.View>
    </View>
  ) : null;

  useEffect(() => {
    if (content === null) hide(id);
    else show(id, content);
  });
  useEffect(
    () => () => {
      hide(id);
    },
    [hide, id],
  );

  return null;
}

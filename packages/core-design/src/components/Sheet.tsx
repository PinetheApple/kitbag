import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type HostInstance,
  type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { IconName } from '../icons.ts';
import { layout, opacity, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { withAlpha } from '../theme.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import {
  SHEET_DRAG_ACTIVATION_DP,
  shouldDismissSheet,
} from '../sheetDismiss.ts';
import { palette, radii } from '../tokens.ts';
import { useReduceMotionMode } from '../useReduceMotion.ts';
import { focusReaderOn } from '../readerFocus';
import { readerHiding } from '../readerHiding.ts';
import { onHardwareBack } from './hardwareBack';
import { InlineIcon } from './IconGlyph.tsx';
import { useSheetPortal } from './SheetHost.tsx';
import { useSheetCardStyle } from './useSheetCardStyle.ts';
import { useSheetExit } from './useSheetExit.ts';

// A scroll view drops every touch outside its frame, so the frame reaches this
// far into the sheet's padding. The right side stays put: the indicator is there.
export const SHEET_TOUCH_ROOM = space.sectionGap;
const INDICATOR_INSETS = { top: SHEET_TOUCH_ROOM, bottom: SHEET_TOUCH_ROOM };
const SCRIM = withAlpha(palette.bg.dark, opacity.sheetScrim);
const FADED_OUT = 0;
const READER_CLOSE_ACTION = 'dismiss';
const BACKDROP_READER_HIDING = readerHiding(true);

const useStyles = createThemedStyles((theme) => ({
  frame: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetSlot: {
    flexShrink: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
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
  titleScreen: textStyle(textRoles.appBarTitle),
  titleAction: {
    marginLeft: 'auto',
  },
  titleBesideAction: {
    flexShrink: 1,
  },
  scrollFrame: {
    flexShrink: 1,
    marginVertical: -SHEET_TOUCH_ROOM,
    marginLeft: -SHEET_TOUCH_ROOM,
  },
  scroll: {
    flexGrow: 0,
  },
  titleGapFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SHEET_TOUCH_ROOM,
    ...(Platform.OS === 'web'
      ? { backgroundColor: theme.color.surface1 }
      : {
          experimental_backgroundImage: `linear-gradient(to bottom, ${theme.color.surface1}, ${withAlpha(theme.color.surface1, FADED_OUT)})`,
        }),
    pointerEvents: 'none',
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
export type SheetTitleSize = 'default' | 'large' | 'screen';

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
  readonly titleAction?: ReactNode;
  readonly hint?: string;
  readonly dismissLabel: string;
  readonly bottomInset?: number;
  readonly onDismiss: () => void;
  readonly onShow?: () => void;
  readonly onClosed?: () => void;
  readonly initialFocusRef?: RefObject<HostInstance | null>;
  readonly dim?: boolean;
  readonly scrollEnabled?: boolean;
  readonly notice?: ReactNode;
  readonly children: ReactNode;
}

export function Sheet({
  visible,
  title,
  titleSize = 'default',
  titleIcon,
  titleAction,
  hint,
  dismissLabel,
  bottomInset = 0,
  onDismiss,
  onShow,
  onClosed,
  initialFocusRef,
  dim = false,
  scrollEnabled = true,
  notice,
  children,
}: SheetProps) {
  const styles = useStyles();
  const titleStyle = [
    styles.title,
    titleSize === 'large' && styles.titleLarge,
    titleSize === 'screen' && styles.titleScreen,
    titleAction !== undefined && styles.titleBesideAction,
  ];
  const motion = useReduceMotionMode();
  const titleRef = useRef<Text>(null);
  const focusTitle = useCallback(() => {
    focusReaderOn(initialFocusRef?.current ?? titleRef.current);
  }, [initialFocusRef]);
  const readerActions = useMemo(
    () => [{ name: READER_CLOSE_ACTION, label: dismissLabel }],
    [dismissLabel],
  );
  const handleReaderAction = useCallback(
    (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === READER_CLOSE_ACTION) onDismiss();
    },
    [onDismiss],
  );
  // Focus sent at mount, mid-slide, did not land on the title under TalkBack.
  const slideIn = useMemo(
    () =>
      SlideInDown.reduceMotion(motion).withCallback((finished) => {
        'worklet';
        if (finished) scheduleOnRN(focusTitle);
      }),
    [motion, focusTitle],
  );
  const dragY = useSharedValue(0);
  const dragAllowed = useSharedValue(visible);
  const sheetHeight = useSharedValue(0);
  const scrimOpacity = useSharedValue(0);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      sheetHeight.value = event.nativeEvent.layout.height;
    },
    [sheetHeight],
  );

  useEffect(() => {
    dragAllowed.value = visible;
  }, [dragAllowed, visible]);
  // A leaving slot keeps the gesture it was shown with, so it gates on a shared value.
  const dragToDismiss = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(SHEET_DRAG_ACTIVATION_DP)
        .onUpdate((event) => {
          if (!dragAllowed.value) return;
          dragY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          if (!dragAllowed.value) return;
          if (shouldDismissSheet(event.translationY, sheetHeight.value)) {
            scheduleOnRN(onDismiss);
            return;
          }
          dragY.value = withSpring(0, { reduceMotion: motion });
        }),
    [dragAllowed, dragY, sheetHeight, onDismiss, motion],
  );

  const sheetStyle = useSheetCardStyle({ visible, bottomInset, dragY });
  const noticeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));

  const { topInset } = useSheetPortal();
  const slotStyle = useMemo(
    () => [styles.sheetSlot, { marginTop: topInset }],
    [styles.sheetSlot, topInset],
  );

  useEffect(() => {
    if (!visible) return undefined;
    onShow?.();
    return onHardwareBack(onDismiss);
    // onShow and onDismiss run per opening, not per new callback identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const content = (
    <View style={styles.frame} onAccessibilityEscape={onDismiss}>
      <Animated.View
        style={[StyleSheet.absoluteFill, dim && styles.scrim, scrimStyle]}
      >
        {/* Over a stacked sheet, TalkBack seated focus on the backdrop, the layer's first node. */}
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityLabel={dismissLabel}
          {...BACKDROP_READER_HIDING}
          onPress={onDismiss}
        />
      </Animated.View>
      {/* Layout animations overwrite transforms, so the drag transform lives on the inner view. */}
      <Animated.View entering={slideIn} style={slotStyle}>
        {notice === undefined ? null : (
          <Animated.View style={noticeStyle}>{notice}</Animated.View>
        )}
        <Animated.View
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
                <Text
                  ref={titleRef}
                  accessibilityRole="header"
                  accessibilityActions={readerActions}
                  onAccessibilityAction={handleReaderAction}
                  style={titleStyle}
                >
                  {title}
                </Text>
                {titleAction === undefined ? null : (
                  <View style={styles.titleAction}>{titleAction}</View>
                )}
              </View>
            </View>
          </GestureDetector>
          <View style={styles.scrollFrame}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              bounces={false}
              scrollEnabled={scrollEnabled}
              keyboardShouldPersistTaps="handled"
              scrollIndicatorInsets={INDICATOR_INSETS}
            >
              {children}
              {hint === undefined ? null : <SheetHint>{hint}</SheetHint>}
            </ScrollView>
            <View style={styles.titleGapFade} />
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );

  useSheetExit({
    visible,
    content,
    motion,
    dragY,
    scrimOpacity,
    onReturn: focusTitle,
    onClosed,
  });

  return null;
}

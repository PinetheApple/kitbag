import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type HostInstance,
  type LayoutChangeEvent,
  type TextInstance,
} from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { IconName } from '../icons.ts';
import {
  contentColumnStyle,
  opacity,
  screenBar,
  size,
  space,
  textRoles,
} from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { withAlpha } from '../theme.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import {
  SHEET_DRAG_ACTIVATION_DP,
  shouldDismissSheet,
} from '../sheetDismiss.ts';
import { palette, radii } from '../tokens.ts';
import { useReduceMotionMode } from '../useReduceMotion.ts';
import { useTextScaled } from '../useTextScaled.ts';
import { focusReaderOn } from '../readerFocus';
import { readerHiding } from '../readerHiding.ts';
import { onHardwareBack } from './hardwareBack';
import { InlineIcon } from './IconGlyph.tsx';
import { SheetContentLiveContext } from './sheetContentLive.ts';
import { SheetHint } from './SheetHint.tsx';
import { useSheetPortal } from './SheetHost.tsx';
import { fadeToClear } from './fadeToClear.ts';
import { useSheetCardStyle } from './useSheetCardStyle.ts';
import { useSheetEnter } from './useSheetEnter.ts';
import { useSheetExit } from './useSheetExit.ts';
import { SHEET_TOUCH_ROOM } from '../sheetRoom.ts';

export {
  SheetHint,
  type SheetHintProps,
  type SheetHintSize,
} from './SheetHint.tsx';

const INDICATOR_INSETS = { top: SHEET_TOUCH_ROOM, bottom: SHEET_TOUCH_ROOM };
const SCRIM = withAlpha(palette.bg.dark, opacity.sheetScrim);
const READER_CLOSE_ACTION = 'dismiss';
const BACKDROP_READER_HIDING = readerHiding(true);

const useStyles = createThemedStyles((theme) => ({
  frame: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetSlot: {
    flexShrink: 1,
    ...contentColumnStyle,
  },
  grow: { flexGrow: 1 },
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
  titleRowWrapped: {
    flexWrap: 'wrap',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.chipGap,
  },
  titleDetail: {
    ...textStyle(textRoles.rowSubtitle),
    color: theme.color.text2,
  },
  scrollFrame: {
    flexShrink: 1,
    margin: -SHEET_TOUCH_ROOM,
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
    ...fadeToClear(theme.color.surface1, 'to bottom'),
    pointerEvents: 'none',
  },
  content: {
    gap: space.sectionGap,
    padding: SHEET_TOUCH_ROOM,
  },
  scrim: {
    backgroundColor: SCRIM,
  },
}));

export type SheetTitleSize = 'default' | 'large' | 'screen';

export interface SheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly titleSize?: SheetTitleSize;
  readonly titleIcon?: IconName;
  readonly titleAction?: ReactNode;
  readonly titleDetail?: string | undefined;
  readonly hint?: string;
  readonly dismissLabel: string;
  readonly bottomInset?: number;
  readonly onDismiss: () => void;
  readonly onShow?: () => void;
  readonly onShown?: () => void;
  readonly onClosed?: () => void;
  readonly initialFocusRef?: RefObject<HostInstance | null>;
  readonly dim?: boolean;
  readonly scrollEnabled?: boolean;
  readonly notice?: ReactNode;
  readonly pinnedBelowBar?: boolean;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}

export function Sheet({
  visible,
  title,
  titleSize = 'default',
  titleIcon,
  titleAction,
  titleDetail,
  hint,
  dismissLabel,
  bottomInset = 0,
  onDismiss,
  onShow,
  onShown,
  onClosed,
  initialFocusRef,
  dim = false,
  scrollEnabled = true,
  notice,
  pinnedBelowBar = false,
  footer,
  children,
}: SheetProps) {
  const styles = useStyles();
  const scaled = useTextScaled();
  const besideAction = titleAction !== undefined && !scaled;
  const titleStyle = [
    styles.title,
    titleSize === 'large' && styles.titleLarge,
    titleSize === 'screen' && styles.titleScreen,
    besideAction && styles.titleBesideAction,
  ];
  const titleGroupStyle = [
    styles.titleGroup,
    besideAction && styles.titleBesideAction,
  ];
  const motion = useReduceMotionMode();
  const titleRef = useRef<TextInstance>(null);
  // Focus sent mid-slide did not land on the title under TalkBack.
  const reportShown = useCallback(() => {
    focusReaderOn(initialFocusRef?.current ?? titleRef.current);
    onShown?.();
  }, [initialFocusRef, onShown]);
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
  const dragY = useSharedValue(0);
  const open = useSharedValue(visible);
  const {
    enter,
    returned,
    slotAttached,
    slotLaidOut,
    style: enterStyle,
  } = useSheetEnter({ motion, open, onShown: reportShown });
  const sheetHeight = useSharedValue(0);
  const scrimOpacity = useSharedValue(0);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      sheetHeight.value = event.nativeEvent.layout.height;
    },
    [sheetHeight],
  );

  useEffect(() => {
    open.value = visible;
  }, [open, visible]);
  // A leaving slot keeps the gesture it was shown with, so it gates on a shared value.
  const dragToDismiss = usePanGesture({
    activeOffsetY: SHEET_DRAG_ACTIVATION_DP,
    onUpdate: (event) => {
      if (!open.value) return;
      dragY.value = Math.max(0, event.translationY);
    },
    onDeactivate: (event) => {
      if (!open.value) return;
      if (shouldDismissSheet(event.translationY, sheetHeight.value)) {
        scheduleOnRN(onDismiss);
        return;
      }
      dragY.value = withSpring(0, { reduceMotion: motion });
    },
  });

  const sheetStyle = useSheetCardStyle({ visible, bottomInset, dragY });
  const noticeStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrimOpacity.value }));

  const { topInset } = useSheetPortal();
  const slotStyle = useMemo(
    () => [
      styles.sheetSlot,
      pinnedBelowBar && styles.grow,
      { marginTop: topInset + (pinnedBelowBar ? screenBar.height : 0) },
    ],
    [styles.sheetSlot, styles.grow, topInset, pinnedBelowBar],
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
      <Animated.View
        ref={slotAttached}
        style={[slotStyle, enterStyle]}
        onLayout={slotLaidOut}
      >
        {notice === undefined ? null : (
          <Animated.View style={noticeStyle}>{notice}</Animated.View>
        )}
        <Animated.View
          style={[styles.sheet, pinnedBelowBar && styles.grow, sheetStyle]}
          onLayout={handleLayout}
        >
          <GestureDetector gesture={dragToDismiss}>
            <View style={styles.header}>
              <View style={styles.grab} />
              <View style={[styles.titleRow, scaled && styles.titleRowWrapped]}>
                <View style={titleGroupStyle}>
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
                </View>
                {titleDetail === undefined ? null : (
                  <Text style={styles.titleDetail}>{titleDetail}</Text>
                )}
                {titleAction === undefined ? null : (
                  <View style={styles.titleAction}>{titleAction}</View>
                )}
              </View>
            </View>
          </GestureDetector>
          <View style={[styles.scrollFrame, pinnedBelowBar && styles.grow]}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              bounces={false}
              persistentScrollbar
              scrollEnabled={scrollEnabled}
              keyboardShouldPersistTaps="handled"
              scrollIndicatorInsets={INDICATOR_INSETS}
            >
              <SheetContentLiveContext.Provider value={open}>
                {children}
              </SheetContentLiveContext.Provider>
              {hint === undefined ? null : <SheetHint>{hint}</SheetHint>}
            </ScrollView>
            <View style={styles.titleGapFade} />
          </View>
          {footer}
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
    onEnter: enter,
    onReturn: returned,
    onClosed,
  });

  return null;
}

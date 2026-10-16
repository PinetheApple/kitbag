import { useCallback, useMemo, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { icons, type IconName } from '../icons.ts';
import { size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import {
  SHEET_DRAG_ACTIVATION_DP,
  shouldDismissSheet,
} from '../sheetDismiss.ts';
import { radii } from '../tokens.ts';

const useStyles = createThemedStyles((theme) => ({
  frame: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    flex: 1,
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
  title: {
    ...textStyle(textRoles.sheetTitle),
    color: theme.color.text,
  },
  scroll: {
    flexGrow: 0,
  },
  content: {
    gap: space.sectionGap,
  },
  hint: {
    ...textStyle(textRoles.hint),
    color: theme.color.text3,
  },
  centered: {
    textAlign: 'center',
  },
}));

export interface SheetHintProps {
  readonly centered?: boolean;
  readonly children: ReactNode;
}

export function SheetHint({ centered = false, children }: SheetHintProps) {
  const styles = useStyles();
  return (
    <Text style={[styles.hint, centered && styles.centered]}>{children}</Text>
  );
}

export interface SheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly titleIcon?: IconName;
  readonly hint?: string;
  readonly dismissLabel: string;
  readonly bottomInset?: number;
  readonly onDismiss: () => void;
  readonly onShow?: () => void;
  readonly children: ReactNode;
}

export function Sheet({
  visible,
  title,
  titleIcon,
  hint,
  dismissLabel,
  bottomInset = 0,
  onDismiss,
  onShow,
  children,
}: SheetProps) {
  const styles = useStyles();
  const reduceMotion = useReducedMotion();
  const dragY = useSharedValue(0);
  const sheetHeight = useSharedValue(0);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      sheetHeight.value = event.nativeEvent.layout.height;
    },
    [sheetHeight],
  );

  const handleShow = useCallback(() => {
    dragY.value = 0;
    onShow?.();
  }, [dragY, onShow]);

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
          dragY.value = reduceMotion ? 0 : withSpring(0);
        }),
    [dragY, sheetHeight, onDismiss, reduceMotion],
  );

  const insetStyle = useMemo(
    () => ({ paddingBottom: space.cardPadding + bottomInset }),
    [bottomInset],
  );

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'slide'}
      onShow={handleShow}
      onRequestClose={onDismiss}
    >
      <GestureHandlerRootView style={styles.frame}>
        <Pressable
          style={styles.scrim}
          accessibilityRole="button"
          accessibilityLabel={dismissLabel}
          onPress={onDismiss}
        />
        <Animated.View
          style={[styles.sheet, insetStyle, dragStyle]}
          onLayout={handleLayout}
        >
          <GestureDetector gesture={dragToDismiss}>
            <View style={styles.header}>
              <View style={styles.grab} />
              <Text accessibilityRole="header" style={styles.title}>
                {titleIcon === undefined
                  ? title
                  : `${icons[titleIcon]} ${title}`}
              </Text>
            </View>
          </GestureDetector>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            bounces={false}
          >
            {children}
            {hint === undefined ? null : <SheetHint>{hint}</SheetHint>}
          </ScrollView>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

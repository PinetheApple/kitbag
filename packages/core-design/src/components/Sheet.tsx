import { useCallback, useMemo, useRef, type ReactNode } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { icons, type IconName } from '../icons.ts';
import { sheetDismissDragFraction, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { radii } from '../tokens.ts';

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
  const sheetHeight = useRef(0);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    sheetHeight.current = event.nativeEvent.layout.height;
  }, []);

  const handleShow = useCallback(() => {
    dragY.value = 0;
    onShow?.();
  }, [dragY, onShow]);

  const dragResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 0,
        onPanResponderMove: (_event, gesture) => {
          dragY.value = Math.max(0, gesture.dy);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > sheetHeight.current * sheetDismissDragFraction) {
            onDismiss();
            return;
          }
          dragY.value = reduceMotion ? 0 : withSpring(0);
        },
        onPanResponderTerminate: () => {
          dragY.value = 0;
        },
      }),
    [dragY, onDismiss, reduceMotion],
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
      <View style={styles.frame}>
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
          <View style={styles.header} {...dragResponder.panHandlers}>
            <View style={styles.grab} />
            <Text accessibilityRole="header" style={styles.title}>
              {titleIcon === undefined ? title : `${icons[titleIcon]} ${title}`}
            </Text>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            bounces={false}
          >
            {children}
            {hint === undefined ? null : <SheetHint>{hint}</SheetHint>}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

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

import {
  useEffect,
  useId,
  useMemo,
  type ComponentProps,
  type ReactNode,
} from 'react';
import {
  StyleSheet,
  View,
  type ColorValue,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated from 'react-native-reanimated';

import { contentColumnStyle } from '../roles.ts';
import { useSheetPortal } from './SheetHost.tsx';

export interface ScreenOverlayProps {
  readonly scrim: ColorValue;
  readonly entering?: ComponentProps<typeof Animated.View>['entering'];
  readonly style?: StyleProp<ViewStyle>;
  readonly children: ReactNode;
}

const styles = StyleSheet.create({
  column: { ...contentColumnStyle, flex: 1 },
});

// Screens sit in the capped content column; drawn there, the scrim would
// leave the side bands undimmed at tablet width, so it goes to a SheetHost slot.
export function ScreenOverlay({
  scrim,
  entering,
  style,
  children,
}: ScreenOverlayProps) {
  const { show, hide } = useSheetPortal();
  const id = useId();
  const scrimStyle = useMemo(
    () => [StyleSheet.absoluteFill, { backgroundColor: scrim }],
    [scrim],
  );
  const column = useMemo(() => [styles.column, style], [style]);
  const node = (
    <Animated.View
      {...(entering === undefined ? null : { entering })}
      accessibilityViewIsModal
      style={scrimStyle}
    >
      <View style={column}>{children}</View>
    </Animated.View>
  );
  useEffect(() => {
    show(id, node, 'open');
  });
  useEffect(
    () => () => {
      hide(id);
    },
    [hide, id],
  );
  return null;
}

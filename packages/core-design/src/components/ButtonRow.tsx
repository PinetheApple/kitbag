import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { space } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { useTextScaled } from '../useTextScaled.ts';

export const BUTTONS_STACKED_ID = 'buttons-stacked';

const useStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', gap: space.controlGap },
  stacked: { gap: space.controlGap },
}));

export interface ButtonRowProps {
  readonly children: ReactNode;
  readonly primaryAt?: 'start' | 'end';
  readonly stacked?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export function ButtonRow({
  children,
  primaryAt = 'end',
  stacked,
  style,
}: ButtonRowProps) {
  const styles = useStyles();
  const scaled = useTextScaled();
  const stack = stacked ?? scaled;
  const buttons = Children.toArray(children);
  if (!stack) return <View style={[styles.row, style]}>{buttons}</View>;
  const natural = buttons.map((button) =>
    isValidElement<{ fill?: boolean }>(button)
      ? cloneElement(button, { fill: false })
      : button,
  );
  return (
    <View testID={BUTTONS_STACKED_ID} style={[styles.stacked, style]}>
      {primaryAt === 'end' ? natural.reverse() : natural}
    </View>
  );
}

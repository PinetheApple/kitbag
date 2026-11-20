import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { space, textRoles } from '../roles.ts';
import { stemPlayer } from '../stemPlayerRoles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';

export const SHEET_STEPPER_GAPS = {
  top: space.sectionGap,
  bottom: space.sectionGap,
};

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.menuRowGap,
    minHeight: minTouchTargetDp,
  },
  label: {
    ...textStyle(textRoles.menuRow),
    color: theme.color.text,
    flexGrow: 1,
    flexShrink: 1,
  },
}));

export function StepperRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

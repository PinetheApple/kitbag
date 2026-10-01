import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { inset, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

export interface EditRowProps {
  readonly label: string;
  readonly children: ReactNode;
}

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.rowGap,
    paddingVertical: inset.editRowV,
    paddingHorizontal: inset.editRowH,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  label: {
    ...textStyle(textRoles.editRowKey),
    color: theme.color.text2,
    flexShrink: 0,
  },
  value: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
    minWidth: 0,
  },
}));

export function EditRow({ label, children }: EditRowProps) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.value}>{children}</View>
    </View>
  );
}

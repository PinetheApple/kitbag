import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { inset, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

export interface SectionHeaderProps {
  readonly label: string;
  readonly trailing?: ReactNode;
}

const useStyles = createThemedStyles((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.controlGap,
    paddingHorizontal: inset.sectionLabelH,
  },
  label: {
    ...textStyle(textRoles.sectionLabel),
    color: theme.color[theme.accentInk],
    flexShrink: 1,
  },
}));

export function SectionHeader({ label, trailing }: SectionHeaderProps) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={styles.label}>
        {label}
      </Text>
      {trailing}
    </View>
  );
}

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { bodyLineHeight, inset, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

const useStyles = createThemedStyles((theme) => ({
  label: {
    ...textStyle(textRoles.sectionLabel),
    lineHeight: textRoles.sectionLabel.size * bodyLineHeight,
    color: theme.color[theme.accentInk],
    paddingHorizontal: inset.sectionLabelH,
  },
  withAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shrinking: { flexShrink: 1 },
}));

export interface SectionHeaderProps {
  readonly label: string;
  readonly action?: ReactNode;
}

export function SectionHeader({ label, action }: SectionHeaderProps) {
  const styles = useStyles();
  if (action === undefined)
    return (
      <Text accessibilityRole="header" style={styles.label}>
        {label}
      </Text>
    );
  return (
    <View style={styles.withAction}>
      <Text accessibilityRole="header" style={[styles.label, styles.shrinking]}>
        {label}
      </Text>
      {action}
    </View>
  );
}

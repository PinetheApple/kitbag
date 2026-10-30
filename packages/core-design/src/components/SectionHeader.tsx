import { Text } from 'react-native';

import { inset, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

const useStyles = createThemedStyles((theme) => ({
  label: {
    ...textStyle(textRoles.sectionLabel),
    color: theme.color[theme.accentInk],
    paddingHorizontal: inset.sectionLabelH,
  },
}));

export function SectionHeader({ label }: { readonly label: string }) {
  const styles = useStyles();
  return (
    <Text accessibilityRole="header" style={styles.label}>
      {label}
    </Text>
  );
}

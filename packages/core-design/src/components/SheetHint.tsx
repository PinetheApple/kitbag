import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

const useStyles = createThemedStyles((theme) => ({
  hint: {
    ...textStyle(textRoles.hint),
    color: theme.color.text3,
  },
  centered: {
    textAlign: 'center',
  },
  hintLarge: textStyle(textRoles.sheetHint),
}));

export type SheetHintSize = 'default' | 'large';

export interface SheetHintProps {
  readonly centered?: boolean;
  readonly size?: SheetHintSize;
  readonly children: ReactNode;
}

export function SheetHint({
  centered = false,
  size: hintSize = 'default',
  children,
}: SheetHintProps) {
  const styles = useStyles();
  return (
    <Text
      style={[
        styles.hint,
        hintSize === 'large' && styles.hintLarge,
        centered && styles.centered,
      ]}
    >
      {children}
    </Text>
  );
}

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
  warning: { color: theme.feedback.warning.ink },
  hintLarge: textStyle(textRoles.sheetHint),
}));

export type SheetHintSize = 'default' | 'large';
export type SheetHintTone = 'plain' | 'warning';

export interface SheetHintProps {
  readonly centered?: boolean;
  readonly size?: SheetHintSize;
  readonly tone?: SheetHintTone;
  readonly children: ReactNode;
}

export function SheetHint({
  centered = false,
  size: hintSize = 'default',
  tone = 'plain',
  children,
}: SheetHintProps) {
  const styles = useStyles();
  return (
    <Text
      style={[
        styles.hint,
        hintSize === 'large' && styles.hintLarge,
        centered && styles.centered,
        tone === 'warning' && styles.warning,
      ]}
    >
      {children}
    </Text>
  );
}

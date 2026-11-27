import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { SheetHint, type SheetHintTone } from './SheetHint.tsx';

const useStyles = createThemedStyles((theme) => ({
  readout: { alignItems: 'center', gap: space.controlGap },
  entry: {
    ...textStyle(textRoles.sheetNumeral),
    color: theme.color.text,
    textAlign: 'center',
  },
}));

export interface NumpadReadoutProps {
  readonly digits: string;
  readonly hint: string;
  readonly hintTone?: SheetHintTone;
  readonly accessibilityLabel?: string;
  readonly children?: ReactNode;
}

export function NumpadReadout({
  digits,
  hint,
  hintTone = 'plain',
  accessibilityLabel,
  children,
}: NumpadReadoutProps) {
  const styles = useStyles();
  return (
    <View style={styles.readout}>
      <Text
        style={styles.entry}
        accessibilityLiveRegion="polite"
        accessibilityLabel={accessibilityLabel}
      >
        {digits}
      </Text>
      {children}
      <SheetHint centered size="large" tone={hintTone}>
        {hint}
      </SheetHint>
    </View>
  );
}

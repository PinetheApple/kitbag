import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { inset, radius, size, space } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { RowText } from './ListRow.tsx';

export const usePlainRowStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.rowGap,
    paddingVertical: inset.rowV,
    paddingHorizontal: inset.rowH,
    borderRadius: radius.row,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface1,
  },
  active: {
    borderColor: theme.color.accentDim,
    backgroundColor: theme.activeCardFill,
  },
  press: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.rowGap,
  },
}));

export interface PlainListRowProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly trailing?: ReactNode;
  readonly active?: boolean;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
  readonly accessibilityLabel: string;
}

export function RowPress(props: PlainListRowProps) {
  const styles = usePlainRowStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      accessibilityState={{ selected: props.active === true }}
      style={styles.press}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
    >
      <RowText title={props.title} subtitle={props.subtitle} />
      {props.trailing}
    </Pressable>
  );
}

export function PlainListRow(props: PlainListRowProps) {
  const styles = usePlainRowStyles();
  return (
    <View style={[styles.row, props.active === true && styles.active]}>
      <RowPress {...props} />
    </View>
  );
}

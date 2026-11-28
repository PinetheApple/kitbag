import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { libraryList } from '../libraryRoles.ts';
import { inset, radius, size, space } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { RowText } from './ListRow.tsx';
import { MenuOpenTint, RowMore } from './RowMore.tsx';

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
  more: {
    marginVertical: -inset.rowV,
    marginLeft: -libraryList.morePull,
    marginRight: libraryList.rowEnd - inset.rowH,
  },
}));

export interface PlainListRowProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly trailing?: ReactNode;
  readonly active?: boolean;
  readonly menuOpen?: boolean;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
  readonly onActions?: () => void;
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

export function PlainRowTint({
  menuOpen,
}: {
  readonly menuOpen: boolean | undefined;
}) {
  return menuOpen === true ? (
    <MenuOpenTint radius={radius.row - size.stroke} />
  ) : null;
}

export function PlainRowMore({
  title,
  onActions,
}: {
  readonly title: string;
  readonly onActions: (() => void) | undefined;
}) {
  const styles = usePlainRowStyles();
  if (onActions === undefined) return null;
  return <RowMore title={title} onPress={onActions} style={styles.more} />;
}

export function PlainListRow(props: PlainListRowProps) {
  const styles = usePlainRowStyles();
  return (
    <View style={[styles.row, props.active === true && styles.active]}>
      <PlainRowTint menuOpen={props.menuOpen} />
      <RowPress {...props} />
      <PlainRowMore title={props.title} onActions={props.onActions} />
    </View>
  );
}

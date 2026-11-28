import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { libraryList } from '../libraryRoles.ts';
import { inset, radius, size, space } from '../roles.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { RowTextWithBadges } from './ListRow.tsx';
import { MenuOpenTint } from './MenuOpenTint.tsx';
import { RowMore } from './RowMore.tsx';

export const PLAIN_ROW_INNER_RADIUS = radius.row - size.stroke;

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
  readonly badges?: ReactNode;
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
      <RowTextWithBadges
        title={props.title}
        subtitle={props.subtitle}
        badges={props.badges}
      />
      {props.trailing}
    </Pressable>
  );
}

export function PlainRowMore({
  subject,
  onActions,
}: {
  readonly subject: string;
  readonly onActions: (() => void) | undefined;
}) {
  const styles = usePlainRowStyles();
  if (onActions === undefined) return null;
  return <RowMore subject={subject} onPress={onActions} style={styles.more} />;
}

export function PlainListRow(props: PlainListRowProps) {
  const styles = usePlainRowStyles();
  return (
    <View style={[styles.row, props.active === true && styles.active]}>
      <MenuOpenTint visible={props.menuOpen} radius={PLAIN_ROW_INNER_RADIUS} />
      <RowPress {...props} />
      <PlainRowMore subject={props.title} onActions={props.onActions} />
    </View>
  );
}

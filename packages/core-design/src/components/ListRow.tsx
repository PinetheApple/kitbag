import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { icons, type IconName } from '../icons.ts';
import { iconSizes, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { radii } from '../tokens.ts';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.rowGap,
    padding: space.cardPadding,
    borderRadius: radii.card,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface1,
  },
  active: {
    borderColor: theme.color.accentDim,
    backgroundColor: theme.activeCardFill,
  },
  tile: {
    width: size.toolIcon,
    height: size.toolIcon,
    borderRadius: radius.toolIcon,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileGlyph: { color: theme.color.text, fontSize: iconSizes.tile },
  body: { flex: 1, minWidth: 0 },
  title: { ...textStyle(textRoles.rowTitle), color: theme.color.text },
  subtitle: { ...textStyle(textRoles.rowSubtitle), color: theme.color.text2 },
  chevron: { color: theme.color.text2, fontSize: iconSizes.action },
}));

export interface RowTextProps {
  readonly title: string;
  readonly subtitle?: string | undefined;
}

export function RowText({ title, subtitle }: RowTextProps) {
  const styles = useStyles();
  return (
    <View style={styles.body}>
      <Text style={styles.title}>{title}</Text>
      {subtitle === undefined ? null : (
        <Text style={styles.subtitle}>{subtitle}</Text>
      )}
    </View>
  );
}

export interface ListRowProps extends RowTextProps {
  readonly icon: IconName;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
  readonly trailing?: ReactNode;
  readonly active?: boolean;
  readonly accessibilityLabel?: string;
}

export function ListRow(props: ListRowProps) {
  const styles = useStyles();
  const { icon, title, subtitle, trailing, active = false } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? title}
      accessibilityState={{ selected: active }}
      style={[styles.row, active && styles.active]}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
    >
      <View style={styles.tile}>
        <Text style={styles.tileGlyph}>{icons[icon]}</Text>
      </View>
      <RowText title={title} subtitle={subtitle} />
      {trailing ?? <Text style={styles.chevron}>{icons.forward}</Text>}
    </Pressable>
  );
}

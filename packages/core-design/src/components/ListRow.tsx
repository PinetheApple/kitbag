import { useCallback, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { IconName } from '../icons.ts';
import { radius, rowLineHeight, size, space, textRoles } from '../roles.ts';
import { rowLabel } from '../rowLabel.ts';
import { switchA11y } from '../switch.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { radii } from '../tokens.ts';
import { Icon } from './Icon.tsx';
import { EllipsizedLine } from './EllipsizedLine.tsx';
import { SwitchTrack } from './Switch.tsx';

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
  body: { flex: 1, minWidth: 0 },
  title: { ...textStyle(textRoles.rowTitle), color: theme.color.text },
  subtitle: { ...textStyle(textRoles.rowSubtitle), color: theme.color.text2 },
  bodyLinesTitle: { lineHeight: rowLineHeight.title },
  bodyLinesSubtitle: { lineHeight: rowLineHeight.subtitle },
}));

export interface RowTextProps {
  readonly title: string;
  readonly subtitle?: string | undefined;
}

export function RowText({
  title,
  subtitle,
  bodyLines = false,
}: RowTextProps & { readonly bodyLines?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.body}>
      <EllipsizedLine
        style={[styles.title, bodyLines && styles.bodyLinesTitle]}
      >
        {title}
      </EllipsizedLine>
      {subtitle === undefined ? null : (
        <EllipsizedLine
          style={[styles.subtitle, bodyLines && styles.bodyLinesSubtitle]}
        >
          {subtitle}
        </EllipsizedLine>
      )}
    </View>
  );
}

export function RowIcon({ icon }: { readonly icon: IconName }) {
  const styles = useStyles();
  return (
    <View style={styles.tile}>
      <Icon name={icon} size="tile" color="text" />
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
      <RowIcon icon={icon} />
      <RowText title={title} subtitle={subtitle} />
      {trailing ?? <Icon name="forward" size="action" />}
    </Pressable>
  );
}

export interface ListSwitchRowProps extends RowTextProps {
  readonly icon: IconName;
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
}

export function ListSwitchRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
}: ListSwitchRowProps) {
  const styles = useStyles();
  const toggle = useCallback(() => {
    onValueChange(!value);
  }, [onValueChange, value]);
  return (
    <Pressable
      {...switchA11y(value)}
      accessibilityLabel={rowLabel(title, subtitle)}
      style={styles.row}
      onPress={toggle}
    >
      <RowIcon icon={icon} />
      <RowText title={title} subtitle={subtitle} bodyLines />
      <SwitchTrack value={value} />
    </Pressable>
  );
}

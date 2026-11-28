import { useCallback, useMemo, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import type { IconName } from '../icons.ts';
import {
  radius,
  rowLineHeight,
  size,
  space,
  textRoles,
  type IconSize,
} from '../roles.ts';
import { rowLabel } from '../rowLabel.ts';
import { libraryList } from '../libraryRoles.ts';
import { switchA11y } from '../switch.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { radii, type ColorToken } from '../tokens.ts';
import { EllipsizedText } from './EllipsizedText.tsx';
import { Icon } from './Icon.tsx';
import { LiveDot } from './LiveDot.tsx';
import { MenuOpenTint, RowMore } from './RowMore.tsx';
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
  split: { padding: 0 },
  splitBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.rowGap,
    paddingVertical: space.cardPadding,
    paddingLeft: space.cardPadding,
  },
  more: {
    marginLeft: space.rowGap - libraryList.morePull,
    marginRight: libraryList.rowEnd,
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
  liveLine: { flexDirection: 'row', alignItems: 'center', gap: space.chipGap },
}));

export interface RowTextProps {
  readonly title: string;
  readonly subtitle?: string | undefined;
  readonly liveDot?: boolean | undefined;
}

export function RowText({
  title,
  subtitle,
  liveDot = false,
  bodyLines = false,
}: RowTextProps & { readonly bodyLines?: boolean }) {
  const styles = useStyles();
  const subtitleText =
    subtitle === undefined ? null : (
      <EllipsizedText
        style={[styles.subtitle, bodyLines && styles.bodyLinesSubtitle]}
      >
        {subtitle}
      </EllipsizedText>
    );
  return (
    <View style={styles.body}>
      <EllipsizedText
        style={[styles.title, bodyLines && styles.bodyLinesTitle]}
      >
        {title}
      </EllipsizedText>
      {subtitle === undefined ? null : liveDot ? (
        <View style={styles.liveLine}>
          <LiveDot />
          {subtitleText}
        </View>
      ) : (
        subtitleText
      )}
    </View>
  );
}

export interface RowIconProps {
  readonly icon: IconName;
  readonly color?: ColorToken;
  readonly border?: ColorToken;
  readonly size?: IconSize;
}

export function RowIcon({
  icon,
  color = 'text',
  border = 'line',
  size: glyph = 'tile',
}: RowIconProps) {
  const styles = useStyles();
  const theme = useTheme();
  const edge = useMemo(
    () => ({ borderColor: theme.color[border] }),
    [theme, border],
  );
  return (
    <View style={[styles.tile, edge]}>
      <Icon name={icon} size={glyph} color={color} />
    </View>
  );
}

export interface ListRowProps extends RowTextProps {
  readonly icon: IconName;
  readonly onPress: () => void;
  readonly onLongPress?: () => void;
  readonly trailing?: ReactNode;
  readonly active?: boolean;
  readonly menuOpen?: boolean;
  readonly onActions?: () => void;
  readonly accessibilityLabel?: string;
}

function ActionsListRow(
  props: ListRowProps & { readonly onActions: () => void },
) {
  const styles = useStyles();
  const { icon, title, subtitle, liveDot, active = false } = props;
  return (
    <View style={[styles.row, styles.split, active && styles.active]}>
      {props.menuOpen === true ? (
        <MenuOpenTint radius={radii.card - size.stroke} />
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel ?? title}
        accessibilityState={{ selected: active }}
        style={styles.splitBody}
        onPress={props.onPress}
        onLongPress={props.onLongPress}
      >
        <RowIcon icon={icon} />
        <RowText title={title} subtitle={subtitle} liveDot={liveDot} />
        {props.trailing}
      </Pressable>
      <RowMore title={title} onPress={props.onActions} style={styles.more} />
    </View>
  );
}

export function ListRow(props: ListRowProps) {
  const styles = useStyles();
  if (props.onActions !== undefined)
    return <ActionsListRow {...props} onActions={props.onActions} />;
  const { icon, title, subtitle, liveDot, trailing, active = false } = props;
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
      <RowText title={title} subtitle={subtitle} liveDot={liveDot} />
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

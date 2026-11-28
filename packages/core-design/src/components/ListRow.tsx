import { useCallback, useMemo, type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import type { IconName } from '../icons.ts';
import {
  radius,
  rowLineHeight,
  size,
  space,
  textRoles,
  type IconSize,
} from '../roles.ts';
import { libraryList } from '../libraryRoles.ts';
import { rowLabel } from '../rowLabel.ts';
import { switchA11y } from '../switch.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { radii, type ColorToken } from '../tokens.ts';
import { useTextScaled } from '../useTextScaled.ts';
import { EllipsizedText } from './EllipsizedText.tsx';
import { Icon } from './Icon.tsx';
import { LiveDot } from './LiveDot.tsx';
import { MenuOpenTint } from './MenuOpenTint.tsx';
import { RowMore } from './RowMore.tsx';
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
    marginLeft: -libraryList.morePull,
    marginRight: libraryList.rowEnd,
  },
  badgesBeside: {
    alignItems: 'flex-end',
    gap: libraryList.badgeGap,
    flexShrink: 0,
  },
  badgesUnder: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: libraryList.badgeGap,
    marginTop: libraryList.badgeGap,
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
  below,
}: RowTextProps & {
  readonly bodyLines?: boolean;
  readonly below?: ReactNode;
}) {
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
      {below}
    </View>
  );
}

function RowBadges({
  badges,
  under,
}: {
  readonly badges: ReactNode;
  readonly under: boolean;
}) {
  const styles = useStyles();
  if (badges === undefined) return null;
  return (
    <View style={under ? styles.badgesUnder : styles.badgesBeside}>
      {badges}
    </View>
  );
}

export function RowTextWithBadges({
  badges,
  ...text
}: RowTextProps & { readonly badges?: ReactNode }) {
  const under = useTextScaled();
  const placed = <RowBadges badges={badges} under={under} />;
  return (
    <>
      <RowText {...text} below={under ? placed : undefined} />
      {under ? null : placed}
    </>
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
  readonly badges?: ReactNode;
  readonly trailing?: ReactNode;
  readonly active?: boolean;
  readonly menuOpen?: boolean;
  readonly onActions?: () => void;
  readonly accessibilityLabel?: string;
}

interface RowBodyProps extends ListRowProps {
  readonly style: StyleProp<ViewStyle>;
  readonly end: ReactNode;
}

function RowBody({ style, end, ...props }: RowBodyProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel ?? props.title}
      accessibilityState={{ selected: props.active === true }}
      style={style}
      onPress={props.onPress}
      onLongPress={props.onLongPress}
    >
      <RowIcon icon={props.icon} />
      <RowTextWithBadges
        title={props.title}
        subtitle={props.subtitle}
        liveDot={props.liveDot}
        badges={props.badges}
      />
      {end}
    </Pressable>
  );
}

function ActionsListRow(
  props: ListRowProps & { readonly onActions: () => void },
) {
  const styles = useStyles();
  return (
    <View
      style={[styles.row, styles.split, props.active === true && styles.active]}
    >
      <MenuOpenTint
        visible={props.menuOpen}
        radius={radii.card - size.stroke}
      />
      <RowBody {...props} style={styles.splitBody} end={props.trailing} />
      <RowMore
        subject={props.title}
        onPress={props.onActions}
        style={styles.more}
      />
    </View>
  );
}

export function ListRow(props: ListRowProps) {
  const styles = useStyles();
  if (props.onActions !== undefined)
    return <ActionsListRow {...props} onActions={props.onActions} />;
  return (
    <RowBody
      {...props}
      style={[styles.row, props.active === true && styles.active]}
      end={props.trailing ?? <Icon name="forward" size="action" />}
    />
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

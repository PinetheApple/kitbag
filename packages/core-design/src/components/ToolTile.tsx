import {
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { icons, type IconName } from '../icons.ts';
import {
  bodyLineHeight,
  iconSizes,
  inset,
  opacity,
  radius,
  size,
  space,
  textRoles,
} from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { packTileRows, type ToolTileSize } from '../toolGrid.ts';
import { radii } from '../tokens.ts';

// An upcoming tool is shown but cannot open: there is nothing behind it yet.
export type ToolStatus = 'ready' | 'upcoming';

const useStyles = createThemedStyles((theme) => ({
  grid: {
    gap: space.rowGap,
  },
  gridRow: {
    flexDirection: 'row',
    gap: space.rowGap,
  },
  gridCell: {
    flex: 1,
  },
  tile: {
    flex: 1,
    gap: space.controlGap,
    padding: space.cardPadding,
    borderRadius: radii.tile,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface1,
  },
  tileGlyph: {
    color: theme.color.text,
    fontSize: iconSizes.toolTile,
    lineHeight: iconSizes.toolTile * bodyLineHeight,
  },
  tileTitle: {
    ...textStyle(textRoles.tileTitle),
    lineHeight: textRoles.tileTitle.size * bodyLineHeight,
    color: theme.color.text,
  },
  tileSubtext: {
    ...textStyle(textRoles.tileSubtext),
    lineHeight: textRoles.tileSubtext.size * bodyLineHeight,
    color: theme.color.text2,
  },
  upcoming: {
    opacity: opacity.upcoming,
  },
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
  rowActive: {
    borderColor: theme.color.accentDim,
    backgroundColor: theme.activeCardFill,
  },
  rowIcon: {
    width: size.toolIcon,
    height: size.toolIcon,
    borderRadius: radius.toolIcon,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconGlyph: {
    color: theme.color.text,
    fontSize: iconSizes.tile,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    ...textStyle(textRoles.rowTitle),
    lineHeight: textRoles.rowTitle.size * bodyLineHeight,
    color: theme.color.text,
  },
  rowSubtitle: {
    ...textStyle(textRoles.rowSubtitle),
    lineHeight: textRoles.rowSubtitle.size * bodyLineHeight,
    color: theme.color.text2,
  },
  chevron: {
    color: theme.color.text2,
    fontSize: iconSizes.action,
  },
  play: {
    paddingVertical: inset.compactButtonV,
    paddingHorizontal: inset.compactButtonH,
    borderRadius: radius.button,
    backgroundColor: theme.color.accent,
  },
  playGlyph: {
    color: theme.color.onAccent,
    fontSize: iconSizes.control,
  },
}));

interface GlyphProps {
  readonly name: IconName;
  readonly style: StyleProp<TextStyle>;
}

function Glyph({ name, style }: GlyphProps) {
  return (
    <Text importantForAccessibility="no-hide-descendants" style={style}>
      {icons[name]}
    </Text>
  );
}

export interface ToolTileProps {
  readonly icon: IconName;
  readonly title: string;
  readonly subtext: string;
  readonly status: ToolStatus;
  readonly onPress?: (() => void) | undefined;
}

export function ToolTile({
  icon,
  title,
  subtext,
  status,
  onPress,
}: ToolTileProps) {
  const styles = useStyles();
  const upcoming = status === 'upcoming';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtext}`}
      accessibilityState={{ disabled: upcoming }}
      disabled={upcoming}
      onPress={onPress}
      style={[styles.tile, upcoming && styles.upcoming]}
    >
      <Glyph name={icon} style={styles.tileGlyph} />
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileSubtext}>{subtext}</Text>
    </Pressable>
  );
}

export interface ToolGridItem extends ToolTileProps {
  readonly id: string;
  readonly size: ToolTileSize;
}

export interface ToolGridProps {
  readonly tiles: readonly ToolGridItem[];
}

export function ToolGrid({ tiles }: ToolGridProps) {
  const styles = useStyles();
  return (
    <View style={styles.grid}>
      {packTileRows(tiles).map((row) => (
        <View key={row.map((t) => t.id).join('|')} style={styles.gridRow}>
          {row.map((tile) => (
            <ToolTile
              key={tile.id}
              icon={tile.icon}
              title={tile.title}
              subtext={tile.subtext}
              status={tile.status}
              onPress={tile.onPress}
            />
          ))}
          {row.length === 1 && row[0]?.size === '1x1' ? (
            <View style={styles.gridCell} />
          ) : null}
        </View>
      ))}
    </View>
  );
}

export interface ToolRowProps {
  readonly icon: IconName;
  readonly title: string;
  readonly subtitle: string;
  readonly status: ToolStatus;
  readonly onPress?: (() => void) | undefined;
  // `resume` draws the accent card with a play key: the Continue card.
  readonly variant?: 'link' | 'resume';
}

export function ToolRow({
  icon,
  title,
  subtitle,
  status,
  onPress,
  variant = 'link',
}: ToolRowProps) {
  const styles = useStyles();
  const upcoming = status === 'upcoming';
  const resume = variant === 'resume';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${subtitle}`}
      accessibilityState={{ disabled: upcoming }}
      disabled={upcoming}
      onPress={onPress}
      style={[
        styles.row,
        resume && styles.rowActive,
        upcoming && styles.upcoming,
      ]}
    >
      <View style={styles.rowIcon}>
        <Glyph name={icon} style={styles.rowIconGlyph} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      {resume ? (
        <View style={styles.play}>
          <Glyph name="play" style={styles.playGlyph} />
        </View>
      ) : (
        <Glyph name="forward" style={styles.chevron} />
      )}
    </Pressable>
  );
}

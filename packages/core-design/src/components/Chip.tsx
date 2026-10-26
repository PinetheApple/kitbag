import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import type { IconName } from '../icons.ts';
import { inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import {
  hitBoxStyle,
  hitExtension,
  neighbourGaps,
  wrappedLineGaps,
  type NeighbourGaps,
} from '../touchTarget.ts';
import { Icon } from './Icon.tsx';

const CHIP_HEIGHT = textRoles.chip.size + (inset.chipV + size.stroke) * 2;

// A chip's width follows its label and is nearly always past 48dp, so only the
// vertical axis is grown.
function chipHitBox(gaps: NeighbourGaps) {
  return hitBoxStyle(
    hitExtension(minTouchTargetDp, CHIP_HEIGHT, {
      top: gaps.top,
      bottom: gaps.bottom,
    }),
  );
}

interface ChipLines {
  readonly fill: boolean;
  readonly gapsFor: (id: string) => NeighbourGaps;
  readonly report: (id: string, lineTop: number | undefined) => void;
}

// Which wrapped line a chip lands on is known only after layout, and only the
// first and last lines border the row's outer gaps.
const ChipLinesContext = createContext<ChipLines | null>(null);

interface ChipFaceProps {
  readonly label: string;
  readonly icon?: IconName | undefined;
  readonly trailingIcon?: IconName | undefined;
  readonly active: boolean;
  readonly liveDot: boolean;
}

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.controlGap,
  },
  chipHit: {
    alignSelf: 'flex-start',
    flexShrink: 1,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 1,
    gap: space.chipGap,
    paddingVertical: inset.chipV,
    paddingHorizontal: inset.chipH,
    borderRadius: radius.chip,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
  },
  chipActive: {
    backgroundColor: theme.activeControlFill,
    borderColor: theme.color.accentDim,
  },
  fill: {
    flexGrow: 1,
  },
  fillHit: {
    alignSelf: 'stretch',
  },
  fillFace: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: inset.chipFillH,
  },
  label: {
    ...textStyle(textRoles.chip),
    color: theme.color.text2,
    flexShrink: 1,
  },
  labelActive: {
    color: theme.color.accent,
  },
  liveDot: {
    width: size.liveDot,
    height: size.liveDot,
    borderRadius: radius.circle,
    backgroundColor: theme.color.green,
  },
}));

function ChipFace({
  label,
  icon,
  trailingIcon,
  active,
  liveDot,
}: ChipFaceProps) {
  const styles = useStyles();
  const glyphColor = active ? 'accent' : 'text2';
  return (
    <>
      {liveDot ? <View style={styles.liveDot} /> : null}
      {icon === undefined ? null : (
        <Icon name={icon} size="chip" color={glyphColor} />
      )}
      <Text
        numberOfLines={1}
        style={[styles.label, active && styles.labelActive]}
      >
        {label}
      </Text>
      {trailingIcon === undefined ? null : (
        <Icon name={trailingIcon} size="chip" color={glyphColor} />
      )}
    </>
  );
}

export interface ChipProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly icon?: IconName;
  readonly trailingIcon?: IconName;
  readonly active?: boolean;
  readonly liveDot?: boolean;
  readonly fill?: boolean;
  readonly accessibilityLabel?: string;
  /** Gaps to the controls above and below, for the 48dp hit box; a number
   * applies to both, an omitted side has no neighbour. */
  readonly neighbourGapDp?: number | NeighbourGaps;
}

export function Chip({
  label,
  onPress,
  icon,
  trailingIcon,
  active = false,
  liveDot = false,
  fill: fillProp = false,
  accessibilityLabel,
  neighbourGapDp,
}: ChipProps) {
  const styles = useStyles();
  const id = useId();
  const lines = useContext(ChipLinesContext);
  const fill = fillProp || (lines?.fill ?? false);
  const hitBox = chipHitBox(
    neighbourGapDp === undefined
      ? (lines?.gapsFor(id) ?? neighbourGaps(space.controlGap))
      : neighbourGaps(neighbourGapDp),
  );
  const report = lines?.report;
  const lineTopOffset = fill ? 0 : hitBox.paddingTop;
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      report?.(id, Math.round(event.nativeEvent.layout.y + lineTopOffset));
    },
    [report, id, lineTopOffset],
  );
  useEffect(
    () => () => {
      report?.(id, undefined);
    },
    [report, id],
  );
  const layoutProps = report === undefined ? {} : { onLayout: handleLayout };
  const pressable = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: active }}
      style={[styles.chipHit, hitBox, fill && styles.fillHit]}
      {...(fill ? {} : layoutProps)}
      onPress={onPress}
    >
      <View
        style={[
          styles.chip,
          active && styles.chipActive,
          fill && styles.fillFace,
        ]}
      >
        <ChipFace
          label={label}
          icon={icon}
          trailingIcon={trailingIcon}
          active={active}
          liveDot={liveDot}
        />
      </View>
    </Pressable>
  );
  if (!fill) return pressable;
  // Yoga drops a grown item's negative margin inside a wrapping row, so the
  // wrapper grows and the hit box's margins stay inside a plain column.
  return (
    <View style={styles.fill} {...layoutProps}>
      {pressable}
    </View>
  );
}

export interface StatusPillProps {
  readonly label: string;
  readonly icon?: IconName;
  readonly active?: boolean;
  readonly liveDot?: boolean;
}

export function StatusPill({
  label,
  icon,
  active = false,
  liveDot = false,
}: StatusPillProps) {
  const styles = useStyles();
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[styles.chip, active && styles.chipActive]}
    >
      <ChipFace label={label} icon={icon} active={active} liveDot={liveDot} />
    </View>
  );
}

export interface ChipRowProps {
  readonly children: ReactNode;
  /** Gaps from the row to the controls above and below it; wrapped lines
   * between them share the row's own gap. */
  readonly neighbourGapDp?: number | NeighbourGaps;
  /** Each line runs edge to edge; a chip that does not fit moves to the next line whole. */
  readonly fill?: boolean;
}

export function ChipRow({
  children,
  neighbourGapDp = space.controlGap,
  fill = false,
}: ChipRowProps) {
  const styles = useStyles();
  const [lineTops, setLineTops] = useState<
    Readonly<Record<string, number | undefined>>
  >({});
  const report = useCallback((id: string, lineTop: number | undefined) => {
    setLineTops((prev) =>
      prev[id] === lineTop ? prev : { ...prev, [id]: lineTop },
    );
  }, []);
  const lines = useMemo<ChipLines>(() => {
    const outer = neighbourGaps(neighbourGapDp);
    const tops = Object.values(lineTops).filter((t) => t !== undefined);
    return {
      fill,
      gapsFor: (id) =>
        wrappedLineGaps(lineTops[id], tops, outer, space.controlGap),
      report,
    };
  }, [fill, lineTops, neighbourGapDp, report]);
  return (
    <ChipLinesContext.Provider value={lines}>
      <View style={styles.row}>{children}</View>
    </ChipLinesContext.Provider>
  );
}

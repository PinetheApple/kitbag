import { Fragment, useCallback, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  iconSizes,
  opacity,
  radius,
  size,
  space,
  textRoles,
} from '../roles.ts';
import { DASHED, TRANSPARENT } from '../styleConstants.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { hitBoxStyle, hitExtension } from '../touchTarget.ts';
import { InlineIcon } from './IconGlyph.tsx';

export const groupTileCopy = {
  plus: '+',
  beats: 'beats',
  remove: 'Remove the last group',
} as const;

const keyHitBox = hitBoxStyle(
  hitExtension(minTouchTargetDp, size.buttonSheet, {
    top: space.controlGap,
    bottom: space.controlGap,
  }),
);

const useStyles = createThemedStyles((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.controlGap },
  tile: {
    width: size.buttonSheet,
    height: size.buttonSheet,
    borderRadius: radius.pick,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slot: {
    backgroundColor: TRANSPARENT,
    borderStyle: DASHED,
    borderColor: theme.color.decor,
  },
  tileValue: { ...textStyle(textRoles.meterPick), color: theme.color.text },
  plus: { ...textStyle(textRoles.button), color: theme.color.text3 },
  sum: {
    ...textStyle(textRoles.stepInlineLargeValue),
    color: theme.color.text,
    marginLeft: 'auto',
  },
  unit: { ...textStyle(textRoles.chip), color: theme.color.text2 },
  keys: { flexDirection: 'row', gap: space.controlGap },
  keyCell: { flex: 1 },
  key: {
    minHeight: size.buttonSheet,
    borderRadius: radius.button,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { opacity: opacity.muted },
  keyLabel: {
    ...textStyle({ ...textRoles.button, tabular: true }),
    color: theme.color.text,
  },
  keyIcon: { fontSize: iconSizes.stepKey, color: theme.color.text },
}));

export function groupSumText(beats: number, barBeats: number) {
  return `${String(beats)} of ${String(barBeats)}`;
}

export interface GroupTilesProps {
  readonly groups: readonly number[];
  readonly beats: number;
  readonly barBeats: number;
  readonly open: boolean;
}

export function GroupTiles({ groups, beats, barBeats, open }: GroupTilesProps) {
  const styles = useStyles();
  const sum = groupSumText(beats, barBeats);
  return (
    <View
      accessible
      accessibilityLabel={`${groups.join(' plus ')}, ${sum} ${groupTileCopy.beats}`}
      style={styles.row}
    >
      {groups.map((beats, i) => (
        <Fragment key={i}>
          {i > 0 ? <Text style={styles.plus}>{groupTileCopy.plus}</Text> : null}
          <View style={styles.tile}>
            <Text style={styles.tileValue}>{String(beats)}</Text>
          </View>
        </Fragment>
      ))}
      {open && groups.length > 0 ? (
        <Text style={styles.plus}>{groupTileCopy.plus}</Text>
      ) : null}
      {open ? <View style={[styles.tile, styles.slot]} /> : null}
      <Text style={styles.sum}>
        {sum} <Text style={styles.unit}>{groupTileCopy.beats}</Text>
      </Text>
    </View>
  );
}

interface KeyProps {
  readonly accessibilityLabel: string;
  readonly disabled: boolean;
  readonly onPress: () => void;
  readonly children: ReactNode;
}

function Key({ accessibilityLabel, disabled, onPress, children }: KeyProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[keyHitBox, styles.keyCell]}
      onPress={onPress}
    >
      <View style={[styles.key, disabled && styles.off]}>{children}</View>
    </Pressable>
  );
}

interface AddKeyProps {
  readonly beats: number;
  readonly disabled: boolean;
  readonly onAdd: (beats: number) => void;
}

function AddKey({ beats, disabled, onAdd }: AddKeyProps) {
  const styles = useStyles();
  const add = useCallback(() => {
    onAdd(beats);
  }, [onAdd, beats]);
  return (
    <Key
      accessibilityLabel={`Add a group of ${String(beats)}`}
      disabled={disabled}
      onPress={add}
    >
      <Text
        style={styles.keyLabel}
      >{`${groupTileCopy.plus}${String(beats)}`}</Text>
    </Key>
  );
}

export interface GroupKeysProps {
  readonly sizes: readonly number[];
  readonly canAdd: (beats: number) => boolean;
  readonly canRemove: boolean;
  readonly onAdd: (beats: number) => void;
  readonly onRemove: () => void;
}

export function GroupKeys({
  sizes,
  canAdd,
  canRemove,
  onAdd,
  onRemove,
}: GroupKeysProps) {
  const styles = useStyles();
  return (
    <View style={styles.keys}>
      {sizes.map((beats) => (
        <AddKey
          key={beats}
          beats={beats}
          disabled={!canAdd(beats)}
          onAdd={onAdd}
        />
      ))}
      <Key
        accessibilityLabel={groupTileCopy.remove}
        disabled={!canRemove}
        onPress={onRemove}
      >
        <InlineIcon name="backspace" style={styles.keyIcon} />
      </Key>
    </View>
  );
}

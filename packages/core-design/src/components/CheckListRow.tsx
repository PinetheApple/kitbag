import { useMemo, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { libraryList, libraryMix } from '../libraryRoles.ts';
import { lineRatio, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { withAlpha } from '../theme.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { useTextIconScale } from '../useTextIconScale.ts';
import { EllipsizedText } from './EllipsizedText.tsx';
import { Icon } from './Icon.tsx';

const useStyles = createThemedStyles((theme) => ({
  row: {
    minHeight: libraryList.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: libraryList.rowGap,
    paddingHorizontal: space.screenInset,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  picked: {
    backgroundColor: withAlpha(theme.color.text, libraryMix.selectedRow),
  },
  all: {
    minHeight: minTouchTargetDp,
    flexDirection: 'row',
    alignItems: 'center',
    gap: libraryList.rowGap,
  },
  box: {
    borderRadius: radius.checkBox,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accent,
  },
  text: { flex: 1, minWidth: 0 },
  title: {
    ...textStyle(textRoles.listTitle),
    lineHeight: textRoles.listTitle.size * lineRatio.title,
    color: theme.color.text,
  },
  facts: {
    ...textStyle(textRoles.listFacts),
    lineHeight: textRoles.listFacts.size * lineRatio.compactBody,
    color: theme.color.text2,
  },
  allLabel: {
    ...textStyle(textRoles.button),
    flex: 1,
    color: theme.color.text,
  },
  allAside: {
    ...textStyle(textRoles.setlistSongMeta),
    fontVariant: ['tabular-nums'],
    color: theme.color.text2,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: libraryList.badgeGap,
    flexShrink: 0,
  },
}));

export function CheckBox({ checked }: { readonly checked: boolean }) {
  const styles = useStyles();
  const scale = useTextIconScale();
  const boxSize = useMemo(
    () => ({ width: size.checkBox * scale, height: size.checkBox * scale }),
    [scale],
  );
  return (
    <View style={[styles.box, boxSize, checked && styles.boxOn]}>
      {checked ? (
        <Icon name="check" size="checkMark" color="onAccent" scale={scale} />
      ) : null}
    </View>
  );
}

export interface CheckListRowProps {
  readonly title: string;
  readonly facts: string;
  readonly checked: boolean;
  readonly onToggle: () => void;
  readonly trailing?: ReactNode;
  readonly accessibilityLabel?: string;
}

export function CheckListRow({
  title,
  facts,
  checked,
  onToggle,
  trailing,
  accessibilityLabel,
}: CheckListRowProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel ?? `${title}, ${facts}`}
      style={[styles.row, checked && styles.picked]}
      onPress={onToggle}
    >
      <CheckBox checked={checked} />
      <View style={styles.text}>
        <EllipsizedText style={styles.title}>{title}</EllipsizedText>
        <EllipsizedText style={styles.facts}>{facts}</EllipsizedText>
      </View>
      {trailing === undefined ? null : (
        <View style={styles.trailing}>{trailing}</View>
      )}
    </Pressable>
  );
}

export interface CheckAllRowProps {
  readonly label: string;
  readonly aside: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onToggle: () => void;
}

export function CheckAllRow({
  label,
  aside,
  checked,
  disabled = false,
  onToggle,
}: CheckAllRowProps) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={`${label}, ${aside}`}
      disabled={disabled}
      style={styles.all}
      onPress={onToggle}
    >
      <CheckBox checked={checked} />
      <Text style={styles.allLabel}>{label}</Text>
      <Text style={styles.allAside}>{aside}</Text>
    </Pressable>
  );
}

import {
  createThemedStyles,
  Icon,
  opacity,
  rowLabel,
  size,
  stemPlayer,
  textRoles,
  textStyle,
  type IconName,
} from '@kitbag/core-design';
import { useStemPlayer } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  CLICK_SECTION,
  clickCopy,
  clickUnavailable,
  type ClickSection,
  groupingLabel,
  rateLabel,
} from '../logic/clickView.ts';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.menuRowGap,
    minHeight: stemPlayer.menuRowMinHeight,
  },
  divided: {
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  disabled: { opacity: opacity.muted },
  body: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  label: { ...textStyle(textRoles.menuRow), color: theme.color.text },
  detail: { ...textStyle(textRoles.rowSubtitle), color: theme.color.text2 },
  value: { ...textStyle(textRoles.menuValue), color: theme.color.text2 },
}));

interface ClickRowProps {
  readonly icon: IconName;
  readonly title: string;
  readonly value: string;
  readonly reason: string | null;
  readonly onPress: () => void;
}

function ClickRow({ icon, title, value, reason, onPress }: ClickRowProps) {
  const styles = useStyles();
  const disabled = reason !== null;
  return (
    <View style={styles.divided}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={rowLabel(title, reason ?? value)}
        accessibilityState={{ disabled }}
        disabled={disabled}
        style={[styles.row, disabled && styles.disabled]}
        onPress={onPress}
      >
        <Icon name={icon} size="title" color="text2" />
        <View style={styles.body}>
          <Text style={styles.label}>{title}</Text>
          {disabled ? <Text style={styles.detail}>{reason}</Text> : null}
        </View>
        {disabled ? null : (
          <>
            <Text style={styles.value}>{value}</Text>
            <Icon name="forward" size="title" color="decor" />
          </>
        )}
      </Pressable>
    </View>
  );
}

export function ClickRows({
  onOpen,
}: {
  readonly onOpen: (section: ClickSection) => void;
}) {
  const reason = useStemPlayer(clickUnavailable);
  const openGrouping = useCallback(() => {
    onOpen(CLICK_SECTION.grouping);
  }, [onOpen]);
  const openRate = useCallback(() => {
    onOpen(CLICK_SECTION.rate);
  }, [onOpen]);
  const grouping = useStemPlayer((s) => groupingLabel(s.clickGrouping));
  const rate = useStemPlayer((s) => rateLabel(s.clickRate));
  return (
    <>
      <ClickRow
        icon="clickGrouping"
        title={clickCopy.groupingRow}
        value={grouping}
        reason={reason}
        onPress={openGrouping}
      />
      <ClickRow
        icon="clickRate"
        title={clickCopy.rateRow}
        value={rate}
        reason={reason}
        onPress={openRate}
      />
    </>
  );
}

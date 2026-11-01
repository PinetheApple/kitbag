import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { size } from '../roles.ts';
import {
  SNACKBAR_DURATION_MS,
  snackbar,
  snackbarText,
} from '../snackbarRoles.ts';
import { startSnackbarTimer } from '../snackbarTimer.ts';
import { textStyle } from '../textStyle.ts';
import { mixHex } from '../theme.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';

export interface SnackbarProps {
  readonly message: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
  readonly onTimeout: () => void;
  readonly bottom: number;
  readonly durationMs?: number;
}

const useStyles = createThemedStyles((theme) => ({
  bar: {
    position: 'absolute',
    left: snackbar.sideInset,
    right: snackbar.sideInset,
    minHeight: snackbar.minHeight,
    borderRadius: snackbar.radius,
    backgroundColor: theme.color.text,
    flexDirection: 'row',
    alignItems: 'center',
    gap: snackbar.gap,
    paddingLeft: snackbar.textLeft,
    paddingRight: snackbar.actionRight,
    boxShadow: theme.shadow,
  },
  message: {
    ...textStyle(snackbarText.message),
    flex: 1,
    color: theme.color.bg,
  },
  action: {
    minHeight: snackbar.actionHeight,
    justifyContent: 'center',
    paddingHorizontal: snackbar.actionH,
    borderLeftWidth: size.stroke,
    borderLeftColor: mixHex(
      theme.color.bg,
      theme.color.text,
      snackbar.dividerMix,
    ),
  },
  actionLabel: {
    ...textStyle(snackbarText.action),
    color: theme.color.bg,
  },
}));

export function Snackbar({
  message,
  actionLabel,
  onAction,
  onTimeout,
  bottom,
  durationMs = SNACKBAR_DURATION_MS,
}: SnackbarProps) {
  const styles = useStyles();
  useEffect(
    () => startSnackbarTimer(durationMs, onTimeout),
    [onTimeout, durationMs],
  );
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[styles.bar, { bottom }]}
    >
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        style={styles.action}
        onPress={onAction}
      >
        <Text style={styles.actionLabel}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

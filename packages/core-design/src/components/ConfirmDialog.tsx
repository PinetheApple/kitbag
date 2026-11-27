import { useEffect } from 'react';
import { Text, View } from 'react-native';

import { dialog, dialogText } from '../dialogRoles.ts';
import { focusReaderOn } from '../readerFocus';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { Button } from './Button.tsx';
import { onHardwareBack } from './hardwareBack';
import { WindowOverlay } from './WindowOverlay.tsx';

const useStyles = createThemedStyles((theme) => ({
  column: {
    justifyContent: 'center',
    paddingHorizontal: dialog.margin,
  },
  dialog: {
    backgroundColor: theme.color.surface2,
    borderRadius: dialog.radius,
    paddingTop: dialog.top,
    paddingHorizontal: dialog.h,
    paddingBottom: dialog.bottom,
    boxShadow: theme.shadow,
  },
  title: {
    ...textStyle(dialogText.title),
    color: theme.color.text,
    marginBottom: dialog.titleBottom,
  },
  body: {
    ...textStyle(dialogText.body),
    lineHeight: dialogText.body.size * dialog.bodyRatio,
    color: theme.color.text2,
    marginBottom: dialog.bodyBottom,
  },
  actions: {
    flexDirection: 'row',
    gap: dialog.actionsGap,
    marginTop: dialog.actionsTop,
  },
}));

export interface ConfirmDialogProps {
  readonly title: string;
  readonly body: string;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function ConfirmDialog({
  title,
  body,
  cancelLabel,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const styles = useStyles();
  useEffect(() => onHardwareBack(onCancel), [onCancel]);
  return (
    <WindowOverlay style={styles.column}>
      <View style={styles.dialog}>
        <Text
          ref={focusReaderOn}
          accessibilityRole="header"
          style={styles.title}
        >
          {title}
        </Text>
        <Text style={styles.body}>{body}</Text>
        <View style={styles.actions}>
          <Button
            fill
            size="target"
            variant="ghost"
            label={cancelLabel}
            onPress={onCancel}
          />
          <Button
            fill
            size="target"
            variant="primary"
            label={confirmLabel}
            onPress={onConfirm}
          />
        </View>
      </View>
    </WindowOverlay>
  );
}

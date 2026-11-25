import {
  Button,
  createThemedStyles,
  focusReaderOn,
  onHardwareBack,
  WindowOverlay,
  stemSections,
  stemSectionsText,
  textStyle,
} from '@kitbag/core-design';
import { useEffect } from 'react';
import { Text, View } from 'react-native';

const useStyles = createThemedStyles((theme) => ({
  column: {
    justifyContent: 'center',
    paddingHorizontal: stemSections.dialogMargin,
  },
  dialog: {
    backgroundColor: theme.color.surface2,
    borderRadius: stemSections.dialogRadius,
    paddingTop: stemSections.dialogTop,
    paddingHorizontal: stemSections.dialogH,
    paddingBottom: stemSections.dialogBottom,
    boxShadow: theme.shadow,
  },
  title: {
    ...textStyle(stemSectionsText.dialogTitle),
    color: theme.color.text,
    marginBottom: stemSections.dialogTitleBottom,
  },
  body: {
    ...textStyle(stemSectionsText.dialogBody),
    lineHeight: stemSectionsText.dialogBody.size * stemSections.dialogBodyRatio,
    color: theme.color.text2,
    marginBottom: stemSections.dialogBodyBottom,
  },
  actions: {
    flexDirection: 'row',
    gap: stemSections.dialogActionsGap,
    marginTop: stemSections.dialogActionsTop,
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

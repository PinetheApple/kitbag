import { Button, Card, type IconName } from '@kitbag/core-design';
import { Text, View } from 'react-native';

import type { NoticeTone } from './logic/failureText.ts';
import { useStemDeckStyles } from './stemDeckStyles.ts';

type CardTone = NoticeTone | 'success';

const ICONS: Readonly<Record<CardTone, IconName>> = {
  danger: 'error',
  warning: 'warning',
  success: 'success',
};

export interface NoticeCardProps {
  readonly tone: CardTone;
  readonly title: string;
  readonly body: string;
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export function NoticeCard({
  tone,
  title,
  body,
  actionLabel,
  onAction,
}: NoticeCardProps) {
  const styles = useStemDeckStyles();
  return (
    <Card emphasis={tone} statusIcon={ICONS[tone]} statusLabel={title}>
      <View style={styles.cardBody}>
        <Text accessibilityRole="header" style={styles.cardTitle}>
          {title}
        </Text>
        <Text accessibilityLiveRegion="polite" style={styles.cardText}>
          {body}
        </Text>
        {actionLabel === undefined || onAction === undefined ? null : (
          <Button
            variant="ghost"
            size="prompt"
            label={actionLabel}
            onPress={onAction}
          />
        )}
      </View>
    </Card>
  );
}

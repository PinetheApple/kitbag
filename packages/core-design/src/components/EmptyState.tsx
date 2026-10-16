import { Text, View } from 'react-native';

import type { IconName } from '../icons.ts';
import { inset, opacity, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { radii } from '../tokens.ts';
import { Button } from './Button.tsx';
import { Icon } from './Icon.tsx';

const useStyles = createThemedStyles((theme) => ({
  box: {
    alignItems: 'center',
    gap: space.rowGap,
    paddingVertical: inset.emptyV,
    paddingHorizontal: space.cardPadding,
    borderRadius: radii.card,
    borderWidth: size.stroke,
    borderStyle: 'dashed',
    borderColor: theme.color.line,
  },
  glyph: { opacity: opacity.emptyIcon },
  title: { ...textStyle(textRoles.emptyTitle), color: theme.color.text },
  reason: {
    ...textStyle(textRoles.emptyReason),
    color: theme.color.text2,
    textAlign: 'center',
  },
}));

export interface EmptyStateProps {
  readonly icon: IconName;
  readonly title: string;
  readonly reason: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
}

export function EmptyState(props: EmptyStateProps) {
  const styles = useStyles();
  return (
    <View style={styles.box}>
      <View style={styles.glyph}>
        <Icon name={props.icon} size="empty" color="text" />
      </View>
      <Text accessibilityRole="header" style={styles.title}>
        {props.title}
      </Text>
      <Text style={styles.reason}>{props.reason}</Text>
      <Button
        variant="primary"
        label={props.actionLabel}
        onPress={props.onAction}
      />
    </View>
  );
}

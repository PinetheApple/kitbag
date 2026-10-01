import { Text, View } from 'react-native';

import { icons, type IconName } from '../icons.ts';
import { iconSizes, inset, opacity, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { radii } from '../tokens.ts';
import { Button } from './Button.tsx';

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
  glyph: {
    color: theme.color.text,
    fontSize: iconSizes.empty,
    opacity: opacity.emptyIcon,
  },
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
      <Text style={styles.glyph}>{icons[props.icon]}</Text>
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

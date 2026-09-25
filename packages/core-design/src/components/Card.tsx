import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { IconName } from '../icons.ts';
import { size, space } from '../roles.ts';
import { FEEDBACK_TOKEN, type FeedbackTone } from '../theme.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { radii } from '../tokens.ts';
import { Icon } from './Icon.tsx';

const useStyles = createThemedStyles((theme) => ({
  card: {
    backgroundColor: theme.color.surface1,
    borderRadius: radii.card,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    padding: space.cardPadding,
  },
  active: {
    backgroundColor: theme.activeCardFill,
    borderColor: theme.color.accentDim,
  },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.rowGap,
  },
  feedbackBody: {
    flex: 1,
  },
  success: { borderColor: theme.feedback.success.cardBorder },
  warning: { borderColor: theme.feedback.warning.cardBorder },
  danger: { borderColor: theme.feedback.danger.cardBorder },
}));

interface CardBaseProps {
  readonly children: ReactNode;
}

interface PlainCardProps extends CardBaseProps {
  readonly emphasis?: 'none';
}

interface ActiveCardProps extends CardBaseProps {
  readonly emphasis: 'active';
  readonly activeLabel: string;
}

interface FeedbackCardProps extends CardBaseProps {
  readonly emphasis: FeedbackTone;
  readonly statusIcon: IconName;
  readonly statusLabel: string;
}

export type CardProps = PlainCardProps | ActiveCardProps | FeedbackCardProps;

export function Card(props: CardProps) {
  const styles = useStyles();

  if ('activeLabel' in props) {
    return (
      <View
        accessible
        accessibilityLabel={props.activeLabel}
        accessibilityState={{ selected: true }}
        style={[styles.card, styles.active]}
      >
        {props.children}
      </View>
    );
  }

  if ('statusIcon' in props) {
    return (
      <View style={[styles.card, styles.feedbackRow, styles[props.emphasis]]}>
        <Icon
          name={props.statusIcon}
          color={FEEDBACK_TOKEN[props.emphasis]}
          accessibilityLabel={props.statusLabel}
        />
        <View style={styles.feedbackBody}>{props.children}</View>
      </View>
    );
  }

  return <View style={styles.card}>{props.children}</View>;
}

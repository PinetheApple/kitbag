import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { IconName } from '../icons.ts';
import { size, space } from '../roles.ts';
import type { FeedbackTone } from '../theme.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { radii, type ColorToken } from '../tokens.ts';
import { Icon } from './Icon.tsx';

const FEEDBACK_ICON_COLOR: Readonly<Record<FeedbackTone, ColorToken>> = {
  success: 'green',
  warning: 'amber',
  danger: 'red',
};

interface CardBaseProps {
  readonly children: ReactNode;
}

interface PlainCardProps extends CardBaseProps {
  readonly emphasis?: 'none' | 'active';
}

// A feedback border alone is colour-only meaning, so the tone brings its icon.
interface FeedbackCardProps extends CardBaseProps {
  readonly emphasis: FeedbackTone;
  readonly statusIcon: IconName;
  readonly statusLabel: string;
}

export type CardProps = PlainCardProps | FeedbackCardProps;

function isFeedback(props: CardProps): props is FeedbackCardProps {
  return (
    props.emphasis !== undefined &&
    props.emphasis !== 'none' &&
    props.emphasis !== 'active'
  );
}

export function Card(props: CardProps) {
  const styles = useStyles();

  if (!isFeedback(props)) {
    return (
      <View style={[styles.card, props.emphasis === 'active' && styles.active]}>
        {props.children}
      </View>
    );
  }

  return (
    <View style={[styles.card, styles.feedbackRow, styles[props.emphasis]]}>
      <Icon
        name={props.statusIcon}
        color={FEEDBACK_ICON_COLOR[props.emphasis]}
        accessibilityLabel={props.statusLabel}
      />
      <View style={styles.feedbackBody}>{props.children}</View>
    </View>
  );
}

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

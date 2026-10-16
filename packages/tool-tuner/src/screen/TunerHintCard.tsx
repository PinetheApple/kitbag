import {
  Button,
  Card,
  createThemedStyles,
  space,
  textRoles,
  textStyle,
  unshared,
} from '@kitbag/core-design';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import type { HintAction, TunerHint } from '../logic/hints.ts';

const useStyles = createThemedStyles((theme) => ({
  body: {
    gap: space.controlGap,
    alignItems: 'flex-start',
  },
  text: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text,
  },
}));

// Only the card's own text sits above the action and only its padding below.
const ACTION_GAPS = {
  top: unshared(space.controlGap),
  bottom: unshared(space.cardPadding),
};

const STATUS_LABEL: Readonly<Record<TunerHint['kind'], string>> = {
  permission: 'Microphone needed',
  micUnavailable: 'Microphone error',
  wrongString: 'Check the string',
  noSound: 'No sound',
};

export interface TunerHintCardProps {
  readonly hint: TunerHint;
  readonly onAction: (action: HintAction) => void;
}

export function TunerHintCard({ hint, onAction }: TunerHintCardProps) {
  const styles = useStyles();
  const action = hint.action;
  const handlePress = useCallback(() => {
    if (action !== undefined) onAction(action.kind);
  }, [action, onAction]);

  return (
    <Card
      emphasis="warning"
      statusIcon="warning"
      statusLabel={STATUS_LABEL[hint.kind]}
    >
      <View style={styles.body}>
        <Text style={styles.text}>{hint.text}</Text>
        {action === undefined ? null : (
          <Button
            label={action.label}
            variant="tonal"
            neighbourGapDp={ACTION_GAPS}
            onPress={handlePress}
          />
        )}
      </View>
    </Card>
  );
}

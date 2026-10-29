import { Pressable, Text, View } from 'react-native';

import type { IconName } from '../icons.ts';
import { libraryList } from '../libraryRoles.ts';
import {
  inset,
  lineRatio,
  opacity,
  radius,
  size,
  space,
  textRoles,
} from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { radii } from '../tokens.ts';
import { Button } from './Button.tsx';
import { Icon } from './Icon.tsx';

export type EmptyStateVariant = 'default' | 'list';

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
  listBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: libraryList.emptyGap,
    paddingHorizontal: libraryList.emptyH,
  },
  listMark: {
    width: libraryList.emptyMark,
    height: libraryList.emptyMark,
    borderRadius: libraryList.emptyMarkRadius,
    backgroundColor: theme.color.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listTitle: {
    ...textStyle(textRoles.listEmptyTitle),
    color: theme.color.text,
    textAlign: 'center',
  },
  listReason: {
    ...textStyle(textRoles.listEmptyReason),
    lineHeight: textRoles.listEmptyReason.size * lineRatio.compactBody,
    color: theme.color.text2,
    textAlign: 'center',
  },
  listButton: {
    minHeight: libraryList.emptyButtonHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: libraryList.emptyButtonGap,
    paddingHorizontal: libraryList.emptyButtonH,
    borderRadius: radius.button,
    borderWidth: size.stroke,
    borderColor: theme.color.accent,
    backgroundColor: theme.color.accent,
  },
  listButtonLabel: {
    ...textStyle(textRoles.button),
    color: theme.color.onAccent,
  },
  listOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: libraryList.emptyOptionGap,
  },
  listOptionText: {
    ...textStyle(textRoles.listEmptyOption),
    lineHeight: textRoles.listEmptyOption.size * lineRatio.compactBody,
    color: theme.color.text2,
  },
}));

export interface EmptyStateOption {
  readonly icon: IconName;
  readonly text: string;
}

export interface EmptyStateProps {
  readonly icon: IconName;
  readonly title: string;
  readonly reason: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
  readonly variant?: EmptyStateVariant;
  readonly actionIcon?: IconName;
  readonly option?: EmptyStateOption | null;
}

function ListEmptyState(props: EmptyStateProps) {
  const styles = useStyles();
  const option = props.option ?? null;
  return (
    <View style={styles.listBox}>
      <View style={styles.listMark}>
        <Icon name={props.icon} size="emptyMark" color="text2" />
      </View>
      <Text accessibilityRole="header" style={styles.listTitle}>
        {props.title}
      </Text>
      <Text style={styles.listReason}>{props.reason}</Text>
      <Pressable
        accessibilityRole="button"
        style={styles.listButton}
        onPress={props.onAction}
      >
        {props.actionIcon === undefined ? null : (
          <Icon name={props.actionIcon} size="emptyButton" color="onAccent" />
        )}
        <Text style={styles.listButtonLabel}>{props.actionLabel}</Text>
      </Pressable>
      {option === null ? null : (
        <View style={styles.listOption}>
          <Icon name={option.icon} size="emptyOption" color="text2" />
          <Text style={styles.listOptionText}>{option.text}</Text>
        </View>
      )}
    </View>
  );
}

export function EmptyState(props: EmptyStateProps) {
  const styles = useStyles();
  if (props.variant === 'list') return <ListEmptyState {...props} />;
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

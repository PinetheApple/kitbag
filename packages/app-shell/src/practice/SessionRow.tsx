import {
  createThemedStyles,
  EllipsizedText,
  hitBoxStyle,
  hitExtension,
  Icon,
  libraryMix,
  lineRatio,
  minTouchTargetDp,
  practiceHistory,
  practiceHistoryText,
  rowLabel,
  size,
  space,
  SwipeDeleteRow,
  textRoles,
  textStyle,
  unshared,
  withAlpha,
} from '@kitbag/core-design';
import type { PracticeSessionListing } from '@kitbag/core-db';
import type { SwipeDirection } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Pressable, Text, View } from 'react-native';

import type { RowText } from './historyText.ts';

const MORE_HIT_BOX = hitBoxStyle(
  hitExtension(practiceHistory.moreWidth, minTouchTargetDp, {
    left: practiceHistory.rowGap,
    right: unshared(practiceHistory.rowEnd),
  }),
);

const DELETE_LABEL = 'Delete';

const useStyles = createThemedStyles((theme) => ({
  row: {
    minHeight: practiceHistory.rowHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: practiceHistory.rowGap,
    paddingLeft: space.screenInset,
    paddingRight: practiceHistory.rowEnd,
    borderBottomWidth: size.stroke,
    borderBottomColor: theme.color.line,
  },
  selected: {
    backgroundColor: withAlpha(theme.color.text, libraryMix.selectedRow),
  },
  body: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: practiceHistory.rowGap,
  },
  text: { flex: 1, minWidth: 0 },
  title: {
    ...textStyle(textRoles.listTitle),
    lineHeight: textRoles.listTitle.size * lineRatio.title,
    color: theme.color.text,
  },
  facts: {
    ...textStyle(textRoles.listFacts),
    lineHeight: textRoles.listFacts.size * lineRatio.compactBody,
    color: theme.color.text2,
  },
  length: {
    ...textStyle(practiceHistoryText.length),
    color: theme.color.text,
  },
  more: {
    ...MORE_HIT_BOX,
    width: practiceHistory.moreWidth,
    height: minTouchTargetDp,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

export interface SessionRowProps {
  readonly session: PracticeSessionListing;
  readonly text: RowText;
  readonly length: string;
  readonly selected: boolean;
  readonly swipe: SwipeDirection;
  readonly onOpen: (uuid: string) => void;
  readonly onActions: (session: PracticeSessionListing) => void;
  readonly onDelete: (session: PracticeSessionListing) => Promise<boolean>;
}

export function SessionRow({
  session,
  text,
  length,
  selected,
  swipe,
  onOpen,
  onActions,
  onDelete,
}: SessionRowProps) {
  const styles = useStyles();
  const open = useCallback(() => {
    onOpen(session.uuid);
  }, [onOpen, session.uuid]);
  const actions = useCallback(() => {
    onActions(session);
  }, [onActions, session]);
  const remove = useCallback(() => onDelete(session), [onDelete, session]);
  return (
    <SwipeDeleteRow side={swipe} deleteLabel={DELETE_LABEL} onDelete={remove}>
      <View style={[styles.row, selected && styles.selected]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rowLabel(
            text.title,
            `${text.subtitle}, ${length}`,
          )}
          style={styles.body}
          onPress={open}
          onLongPress={actions}
        >
          <View style={styles.text}>
            <EllipsizedText style={styles.title}>{text.title}</EllipsizedText>
            <EllipsizedText style={styles.facts}>
              {text.subtitle}
            </EllipsizedText>
          </View>
          <Text style={styles.length}>{length}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Actions for ${text.title}`}
          style={styles.more}
          onPress={actions}
        >
          <Icon name="more" size="bar" color="text2" />
        </Pressable>
      </View>
    </SwipeDeleteRow>
  );
}

import {
  createThemedStyles,
  practiceHistory,
  practiceHistoryText,
  space,
  textStyle,
} from '@kitbag/core-design';
import type { PracticeSessionListing } from '@kitbag/core-db';
import type {
  HistoryGroup,
  HistoryGrouping,
  SwipeDirection,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';

import {
  groupLabel,
  groupTotal,
  sessionLength,
  sessionRowText,
  type SessionNames,
} from './historyText.ts';
import { SessionRow } from './SessionRow.tsx';

const useStyles = createThemedStyles((theme) => ({
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: practiceHistory.sectionTop,
    paddingBottom: practiceHistory.sectionBottom,
    paddingHorizontal: space.screenInset,
  },
  label: {
    ...textStyle(practiceHistoryText.section),
    color: theme.color.text2,
  },
  total: {
    ...textStyle(practiceHistoryText.sectionTotal),
    color: theme.color.text2,
  },
}));

export interface HistoryRowHandlers {
  readonly onOpen: (uuid: string) => void;
  readonly onActions: (session: PracticeSessionListing) => void;
  readonly onDelete: (session: PracticeSessionListing) => Promise<boolean>;
}

interface GroupProps extends HistoryRowHandlers {
  readonly group: HistoryGroup;
  readonly grouping: HistoryGrouping;
  readonly now: Date;
  readonly names: SessionNames;
  readonly swipe: SwipeDirection;
  readonly selected: string | null;
  readonly onLayoutGroup: (start: Date, y: number) => void;
}

function Group({
  group,
  grouping,
  now,
  names,
  swipe,
  selected,
  onLayoutGroup,
  ...handlers
}: GroupProps) {
  const styles = useStyles();
  const layout = useCallback(
    (event: LayoutChangeEvent) => {
      onLayoutGroup(group.start, event.nativeEvent.layout.y);
    },
    [onLayoutGroup, group.start],
  );
  return (
    <View onLayout={layout}>
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.label}>
          {groupLabel(group.start, grouping, now)}
        </Text>
        <Text style={styles.total}>{groupTotal(group, grouping)}</Text>
      </View>
      {group.sessions.map((session) => (
        <SessionRow
          key={session.uuid}
          session={session}
          text={sessionRowText(session, grouping, now, names)}
          length={sessionLength(session)}
          selected={selected === session.uuid}
          swipe={swipe}
          {...handlers}
        />
      ))}
    </View>
  );
}

export interface HistoryListProps extends HistoryRowHandlers {
  readonly groups: readonly HistoryGroup[];
  readonly grouping: HistoryGrouping;
  readonly now: Date;
  readonly names: SessionNames;
  readonly swipe: SwipeDirection;
  readonly selected: string | null;
  readonly onLayoutGroup: (start: Date, y: number) => void;
  readonly onLayout: (event: LayoutChangeEvent) => void;
}

export function HistoryList({ groups, onLayout, ...rest }: HistoryListProps) {
  return (
    <View onLayout={onLayout}>
      {groups.map((group) => (
        <Group key={group.start.getTime()} group={group} {...rest} />
      ))}
    </View>
  );
}

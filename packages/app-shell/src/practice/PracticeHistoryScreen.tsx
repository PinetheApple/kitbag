import {
  AppBar,
  createThemedStyles,
  EmptyState,
  practiceHistory,
  practiceHistoryText,
  SegmentedControl,
  Snackbar,
  snackbar,
  space,
  textStyle,
  type SegmentOption,
} from '@kitbag/core-design';
import type { PracticeStats } from '@kitbag/core-db';
import type { HistoryGrouping } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatPracticeSummary } from '../settings/practiceText.ts';
import { HistoryGraph } from './HistoryGraph.tsx';
import { HistoryList } from './HistoryList.tsx';
import { SessionActionsSheet } from './SessionActionsSheet.tsx';
import { usePracticeHistoryScreen } from './usePracticeHistoryScreen.ts';

const GROUPING_OPTIONS: readonly SegmentOption<HistoryGrouping>[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  scroll: { flex: 1 },
  head: {
    paddingTop: practiceHistory.bodyTop,
    paddingHorizontal: space.screenInset,
    gap: practiceHistory.bodyGap,
  },
  totals: {
    ...textStyle(practiceHistoryText.totals),
    paddingTop: practiceHistory.totalsTop,
    paddingBottom: practiceHistory.totalsBottom,
    color: theme.color.text2,
  },
  lead: {
    ...textStyle(practiceHistoryText.totalsLead),
    color: theme.color.text,
  },
}));

function Totals({ stats }: { readonly stats: PracticeStats | null }) {
  const styles = useStyles();
  if (stats === null) return null;
  const { lead, detail } = formatPracticeSummary(stats);
  if (lead === null) return <Text style={styles.totals}>{detail}</Text>;
  return (
    <Text style={styles.totals}>
      <Text style={styles.lead}>{lead}</Text>
      {` ${detail}`}
    </Text>
  );
}

export interface PracticeHistoryScreenProps {
  readonly onBack: () => void;
  readonly onOpenSession: (uuid: string) => void;
  readonly onOpenMetronome: () => void;
}

export function PracticeHistoryScreen({
  onBack,
  onOpenSession,
  onOpenMetronome,
}: PracticeHistoryScreenProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const model = usePracticeHistoryScreen();
  const { actions } = model;
  const frame = useMemo(
    () => [styles.screen, { paddingTop: insets.top }],
    [styles.screen, insets.top],
  );
  const content = useMemo(
    () => ({ paddingBottom: insets.bottom + space.screenInset }),
    [insets.bottom],
  );
  const empty = model.ready && !model.failed && model.sessions.length === 0;
  const { refresh } = model;
  const retry = useCallback(() => {
    void refresh();
  }, [refresh]);
  return (
    <View style={frame}>
      <AppBar flush title="Practice history" onBack={onBack} />
      {model.failed ? (
        <EmptyState
          variant="list"
          icon="warning"
          title="Practice history could not be opened"
          reason="The saved sessions failed to load. The metronome still records new ones."
          actionIcon="reset"
          actionLabel="Try again"
          option={null}
          onAction={retry}
        />
      ) : empty ? (
        <EmptyState
          variant="list"
          icon="practice"
          title="No sessions yet"
          reason="Play the metronome, tap End on the practice pill, then Save. The session shows up here."
          actionIcon="metronome"
          actionLabel="Open metronome"
          option={null}
          onAction={onOpenMetronome}
        />
      ) : (
        <ScrollView
          ref={model.scroll}
          style={styles.scroll}
          contentContainerStyle={content}
        >
          <View style={styles.head}>
            <Totals stats={model.stats} />
            <SegmentedControl
              fill
              size="tab"
              accessibilityLabel="Group sessions by"
              options={GROUPING_OPTIONS}
              selected={model.grouping}
              onSelect={model.setGrouping}
            />
            <HistoryGraph
              bars={model.bars}
              grouping={model.grouping}
              onBarPress={model.scrollToGroup}
            />
          </View>
          <HistoryList
            groups={model.groups}
            grouping={model.grouping}
            now={model.now}
            names={model.names}
            swipe={model.swipe}
            selected={actions.target?.uuid ?? null}
            onOpen={onOpenSession}
            onActions={actions.onActions}
            onDelete={actions.onDelete}
            onLayoutGroup={model.onLayoutGroup}
            onLayout={model.onListLayout}
          />
        </ScrollView>
      )}
      {model.deletedText === null ? null : (
        <Snackbar
          message={model.deletedText}
          actionLabel="Undo"
          onAction={model.undoDelete}
          onTimeout={model.dismissDeleted}
          bottom={insets.bottom + snackbar.aboveSheet}
        />
      )}
      <SessionActionsSheet
        target={actions.target}
        title={model.targetTitle}
        bottomInset={insets.bottom}
        onOpen={onOpenSession}
        onDelete={actions.onDelete}
        onDismiss={actions.closeActions}
      />
    </View>
  );
}

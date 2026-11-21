import type { PracticeSessionListing } from '@kitbag/core-db';
import {
  groupSessions,
  historyGraph,
  useHistoryPrefs,
  usePracticeHistory,
} from '@kitbag/core-state';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, ScrollViewInstance } from 'react-native';

import { deletedMessage, sessionRowText } from './historyText.ts';
import { useSessionNames } from './useSessionNames.ts';

function useScrollToGroup() {
  const scroll = useRef<ScrollViewInstance>(null);
  const listTop = useRef(0);
  const groupTops = useRef(new Map<number, number>());
  const onListLayout = useCallback((event: LayoutChangeEvent) => {
    listTop.current = event.nativeEvent.layout.y;
  }, []);
  const onLayoutGroup = useCallback((start: Date, y: number) => {
    groupTops.current.set(start.getTime(), y);
  }, []);
  const scrollToGroup = useCallback((start: Date) => {
    const y = groupTops.current.get(start.getTime());
    if (y !== undefined) scroll.current?.scrollTo({ y: listTop.current + y });
  }, []);
  return { scroll, onListLayout, onLayoutGroup, scrollToGroup };
}

function useHistoryActions() {
  const remove = usePracticeHistory((s) => s.remove);
  const [target, setTarget] = useState<PracticeSessionListing | null>(null);
  const onActions = useCallback((session: PracticeSessionListing) => {
    setTarget(session);
  }, []);
  const closeActions = useCallback(() => {
    setTarget(null);
  }, []);
  const onDelete = useCallback(
    (session: PracticeSessionListing) =>
      remove(session.uuid).then(
        () => true,
        (error: unknown) => {
          console.warn('[kitbag] could not delete the practice session', error);
          return false;
        },
      ),
    [remove],
  );
  return { target, onActions, closeActions, onDelete };
}

export function usePracticeHistoryScreen() {
  const refresh = usePracticeHistory((s) => s.refresh);
  const sessions = usePracticeHistory((s) => s.sessions);
  const stats = usePracticeHistory((s) => s.stats);
  const ready = usePracticeHistory((s) => s.ready);
  const failed = usePracticeHistory((s) => s.failed);
  const deleted = usePracticeHistory((s) => s.deleted);
  const undo = usePracticeHistory((s) => s.undo);
  const dismissDeleted = usePracticeHistory((s) => s.dismissDeleted);
  const grouping = useHistoryPrefs((s) => s.grouping);
  const setGrouping = useHistoryPrefs((s) => s.setGrouping);
  const swipe = useHistoryPrefs((s) => s.swipeDirection);
  useEffect(() => dismissDeleted, [dismissDeleted]);
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      void refresh();
    }, [refresh]),
  );
  const groups = useMemo(
    () => groupSessions(sessions, grouping),
    [sessions, grouping],
  );
  const bars = useMemo(
    () => historyGraph(sessions, grouping, now),
    [sessions, grouping, now],
  );
  const names = useSessionNames();
  const actions = useHistoryActions();
  const undoDelete = useCallback(() => {
    undo().catch((error: unknown) => {
      console.warn('[kitbag] could not restore the practice session', error);
    });
  }, [undo]);
  const targetTitle =
    actions.target === null
      ? ''
      : sessionRowText(actions.target, grouping, now, names).title;
  return {
    ready,
    failed,
    refresh,
    sessions,
    stats,
    grouping,
    setGrouping,
    swipe,
    now,
    groups,
    bars,
    names,
    actions,
    targetTitle,
    deletedText: deleted === null ? null : deletedMessage(deleted.session, now),
    undoDelete,
    dismissDeleted,
    ...useScrollToGroup(),
  };
}

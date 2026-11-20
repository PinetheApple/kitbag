import {
  AppBar,
  type AppBarAction,
  Button,
  createThemedStyles,
  practiceHistory,
  practiceHistoryText,
  size,
  space,
  textStyle,
} from '@kitbag/core-design';
import type { SavedPracticeSession } from '@kitbag/core-db';
import { formatClockSeconds, SESSION_LOAD } from '@kitbag/core-state';
import { useMemo, type ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  detailHeading,
  LOAD_HINT,
  loadLabel,
  OLD_SESSION_NOTE,
  repeatHint,
  summaryHint,
} from './detailText.ts';
import { OldSessionSongs } from './OldSessionSongs.tsx';
import { DELETE_SESSION_LABEL } from './SessionActionsSheet.tsx';
import { TimelineRows } from './TimelineRows.tsx';
import { useSessionDetail } from './useSessionDetail.ts';

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  scroll: { flex: 1 },
  content: {
    paddingTop: practiceHistory.bodyTop,
    paddingHorizontal: space.screenInset,
    gap: practiceHistory.bodyGap,
  },
  summary: {
    alignItems: 'center',
    paddingTop: practiceHistory.summaryTop,
    paddingBottom: practiceHistory.summaryBottom,
  },
  total: {
    ...textStyle(practiceHistoryText.summary),
    color: theme.color.text,
  },
  hint: {
    ...textStyle(practiceHistoryText.summaryHint),
    color: theme.color.text2,
  },
  section: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: practiceHistory.flushSectionTop,
  },
  label: {
    ...textStyle(practiceHistoryText.section),
    color: theme.color.text2,
  },
  aside: {
    ...textStyle(practiceHistoryText.sectionTotal),
    color: theme.color.text2,
  },
  note: {
    ...textStyle(practiceHistoryText.note),
    paddingVertical: practiceHistory.oldNoteV,
    paddingHorizontal: practiceHistory.oldNoteH,
    color: theme.color.text2,
  },
  foot: {
    gap: practiceHistory.footGap,
    paddingTop: practiceHistory.footTop,
    paddingHorizontal: space.screenInset,
    borderTopWidth: size.stroke,
    borderTopColor: theme.color.line,
    backgroundColor: theme.color.bg,
  },
  footHint: {
    ...textStyle(practiceHistoryText.note),
    textAlign: 'center',
    color: theme.color.text2,
  },
}));

function Section({
  label,
  aside,
}: {
  readonly label: string;
  readonly aside: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.label}>
        {label}
      </Text>
      <Text style={styles.aside}>{aside}</Text>
    </View>
  );
}

function Foot({
  children,
  hint,
}: {
  readonly children: ReactNode;
  readonly hint: string;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const inset = { paddingBottom: insets.bottom + practiceHistory.footBottom };
  return (
    <View style={[styles.foot, inset]}>
      {children}
      <Text style={styles.footHint}>{hint}</Text>
    </View>
  );
}

type Detail = ReturnType<typeof useSessionDetail>;

function Body({
  detail,
  session,
}: {
  readonly detail: Detail;
  readonly session: SavedPracticeSession;
}) {
  const styles = useStyles();
  if (detail.timeline !== null)
    return (
      <>
        <Section label="In the order played" aside="play time" />
        <TimelineRows
          entries={detail.timeline}
          setlistSize={detail.setlistSize}
        />
      </>
    );
  return (
    <>
      <Section label="Songs" aside="order not recorded" />
      <OldSessionSongs
        songUuids={session.songUuids}
        songTitle={detail.names.song}
      />
      <Text style={styles.note}>{OLD_SESSION_NOTE}</Text>
    </>
  );
}

function Action({ detail }: { readonly detail: Detail }) {
  if (detail.plan !== null)
    return (
      <Foot hint={repeatHint(detail.plan)}>
        <Button
          variant="primary"
          icon="repeat"
          label="Repeat this session"
          onPress={detail.repeat}
        />
      </Foot>
    );
  if (detail.load !== null)
    return (
      <Foot hint={LOAD_HINT}>
        <Button
          variant="ghost"
          icon={detail.load.kind === SESSION_LOAD.song ? 'song' : 'setlist'}
          label={loadLabel(detail.load)}
          onPress={detail.loadSession}
        />
      </Foot>
    );
  return null;
}

export interface SessionDetailScreenProps {
  readonly uuid: string;
  readonly onBack: () => void;
  readonly onLoaded: () => void;
}

export function SessionDetailScreen({
  uuid,
  onBack,
  onLoaded,
}: SessionDetailScreenProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const routes = useMemo(
    () => ({ onLoaded, onDeleted: onBack }),
    [onLoaded, onBack],
  );
  const detail = useSessionDetail(uuid, routes);
  const actions: readonly AppBarAction[] = useMemo(
    () => [
      {
        icon: 'delete',
        label: DELETE_SESSION_LABEL,
        onPress: detail.deleteSession,
      },
    ],
    [detail.deleteSession],
  );
  const { session } = detail;
  const heading =
    session === null ? null : detailHeading(session.startedAt, detail.now);
  const framed = { paddingTop: insets.top };
  return (
    <View style={[styles.screen, framed]}>
      <AppBar
        flush
        title={heading?.title ?? ''}
        subtitle={heading?.subtitle}
        onBack={onBack}
        actions={session === null ? [] : actions}
      />
      {session === null ? null : (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
          >
            <View style={styles.summary}>
              <Text style={styles.total}>
                {formatClockSeconds(session.durationSeconds)}
              </Text>
              <Text style={styles.hint}>
                {summaryHint(session, detail.names)}
              </Text>
            </View>
            <Body detail={detail} session={session} />
          </ScrollView>
          <Action detail={detail} />
        </>
      )}
    </View>
  );
}

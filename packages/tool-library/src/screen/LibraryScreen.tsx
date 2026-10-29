import {
  Button,
  Card,
  createThemedStyles,
  EmptyState,
  FloatingActionButton,
  libraryList,
  lineRatio,
  ScreenAppBar,
  SearchField,
  space,
  textRoles,
  textStyle,
  type ScreenBarAction,
} from '@kitbag/core-design';
import {
  filterRows,
  inView,
  useSongLibrary,
  type LibraryView,
} from '@kitbag/core-state';
import { useCallback, useEffect, useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { copyingText, noticeLook, noticeText } from '../logic/notices.ts';
import { VIEW_TEXT, type ViewText } from '../logic/viewText.ts';
import { LibraryRowView } from './LibraryRowView.tsx';
import {
  LibrarySheets,
  useLibraryMenu,
  type LibraryMenu,
} from './LibrarySheets.tsx';

export interface LibraryScreenInsets {
  readonly top: number;
  readonly bottom: number;
}

export interface LibraryScreenProps {
  readonly view: LibraryView;
  readonly insets: LibraryScreenInsets;
  readonly onBack: () => void;
  readonly onOpenStemSet: (id: number) => void;
  readonly onOpenSetlists?: () => void;
}

const FAB_ROOM = libraryList.fab + libraryList.fabBottom;

const useStyles = createThemedStyles((theme) => ({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  title: {
    ...textStyle(textRoles.appBarTitle),
    lineHeight: textRoles.appBarTitle.size * lineRatio.appBarTitle,
    color: theme.color.text,
  },
  body: {
    flex: 1,
    paddingTop: libraryList.bodyTop,
    gap: libraryList.bodyGap,
  },
  inset: { paddingHorizontal: space.screenInset, gap: libraryList.bodyGap },
  list: { flex: 1 },
  content: { flexGrow: 1, gap: libraryList.bodyGap },
  cardBody: { gap: space.controlGap, alignItems: 'flex-start' },
  cardText: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
}));

function ImportingCard() {
  const styles = useStyles();
  const importing = useSongLibrary((s) => s.importing);
  if (importing.length === 0) return null;
  return (
    <Card>
      <Text accessibilityLiveRegion="polite" style={styles.cardText}>
        {copyingText(importing)}
      </Text>
    </Card>
  );
}

function NoticeCard() {
  const styles = useStyles();
  const notice = useSongLibrary((s) => s.notice);
  const dismiss = useSongLibrary((s) => s.dismissNotice);
  if (notice === null) return null;
  const { status, text } = noticeText(notice);
  const { tone, icon } = noticeLook(notice);
  return (
    <Card emphasis={tone} statusIcon={icon} statusLabel={status}>
      <View style={styles.cardBody}>
        <Text accessibilityLiveRegion="polite" style={styles.cardText}>
          {text}
        </Text>
        <Button label="Dismiss" variant="ghost" onPress={dismiss} />
      </View>
    </Card>
  );
}

function StatusCards() {
  const styles = useStyles();
  const shown = useSongLibrary(
    (s) => s.notice !== null || s.importing.length > 0,
  );
  if (!shown) return null;
  return (
    <View style={styles.inset}>
      <NoticeCard />
      <ImportingCard />
    </View>
  );
}

interface SearchBarProps {
  readonly text: ViewText;
  readonly covered: boolean;
}

function SearchBar({ text, covered }: SearchBarProps) {
  const styles = useStyles();
  const query = useSongLibrary((s) => s.query);
  const replacing = useSongLibrary((s) => s.replacePrompt !== null);
  const setQuery = useSongLibrary((s) => s.setQuery);
  const clear = useCallback(() => {
    setQuery('');
  }, [setQuery]);
  return (
    <View style={styles.inset}>
      <SearchField
        variant="list"
        value={query}
        onChangeText={setQuery}
        placeholder={text.search}
        accessibilityLabel={text.searchLabel}
        editable={!covered && !replacing}
        onClear={clear}
      />
    </View>
  );
}

function LibraryUnavailable() {
  const refresh = useSongLibrary((s) => s.refresh);
  const retry = useCallback(() => {
    void refresh();
  }, [refresh]);
  return (
    <EmptyState
      variant="list"
      icon="warning"
      title="Your songs could not be opened"
      reason="The song library failed to load. The metronome and tuner still work."
      actionIcon="reset"
      actionLabel="Try again"
      option={null}
      onAction={retry}
    />
  );
}

interface ListProps {
  readonly view: LibraryView;
  readonly menu: LibraryMenu;
  readonly onOpenStemSet: (id: number) => void;
}

function SongList({ view, menu, onOpenStemSet }: ListProps) {
  const styles = useStyles();
  const rows = useSongLibrary((s) => s.rows);
  const query = useSongLibrary((s) => s.query);
  const shown = useMemo(
    () => filterRows(rows, query, view),
    [rows, query, view],
  );
  if (shown.length === 0 && query.trim() === '') return null;
  if (shown.length === 0)
    return (
      <View style={styles.inset}>
        <Card>
          <Text style={styles.cardText}>{VIEW_TEXT[view].noMatch}</Text>
        </Card>
      </View>
    );
  const open = menu.kind === 'none' ? null : menu.target;
  return (
    <View>
      {shown.map((row) => (
        <LibraryRowView
          key={`${row.kind}-${String(row.id)}`}
          row={row}
          selected={open?.kind === row.kind && open.id === row.id}
          onActions={menu.openActions}
          onOpenStemSet={onOpenStemSet}
        />
      ))}
    </View>
  );
}

type ViewState = 'failed' | 'loading' | 'empty' | 'list';

function useViewState(view: LibraryView): ViewState {
  return useSongLibrary((s) => {
    if (s.failed) return 'failed';
    if (!s.ready) return 'loading';
    const has = s.rows.some((row) => inView(row, view));
    return has || s.importing.length > 0 ? 'list' : 'empty';
  });
}

function useViewImport(view: LibraryView) {
  const importSong = useSongLibrary((s) => s.importSong);
  const importStemFolder = useSongLibrary((s) => s.importStemFolder);
  return useCallback(() => {
    void (view === 'stems' ? importStemFolder() : importSong());
  }, [view, importSong, importStemFolder]);
}

interface BodyProps extends ListProps {
  readonly state: ViewState;
}

function LibraryBody({ view, state, menu, onOpenStemSet }: BodyProps) {
  const startImport = useViewImport(view);
  const text = VIEW_TEXT[view];
  if (state === 'failed') return <LibraryUnavailable />;
  if (state === 'loading') return null;
  if (state === 'empty')
    return (
      <EmptyState
        variant="list"
        icon="songs"
        title={text.emptyTitle}
        reason={text.emptyReason}
        actionIcon="add"
        actionLabel={text.emptyAction}
        option={text.emptyOption}
        onAction={startImport}
      />
    );
  return <SongList view={view} menu={menu} onOpenStemSet={onOpenStemSet} />;
}

function useEntry() {
  const refresh = useSongLibrary((s) => s.refresh);
  const setQuery = useSongLibrary((s) => s.setQuery);
  useEffect(() => {
    setQuery('');
    void refresh();
  }, [refresh, setQuery]);
}

export function LibraryScreen({
  view,
  insets,
  onBack,
  onOpenStemSet,
  onOpenSetlists,
}: LibraryScreenProps) {
  const styles = useStyles();
  useEntry();
  const menu = useLibraryMenu();
  const startImport = useViewImport(view);
  const text = VIEW_TEXT[view];
  const state = useViewState(view);
  const listed = state === 'list';
  const actions: readonly ScreenBarAction[] = useMemo(
    () =>
      onOpenSetlists === undefined
        ? []
        : [{ icon: 'setlist', label: 'Setlists', onPress: onOpenSetlists }],
    [onOpenSetlists],
  );
  const frame = useMemo(
    () => [styles.screen, { paddingTop: insets.top }],
    [styles.screen, insets.top],
  );
  const content = useMemo(
    () => [styles.content, { paddingBottom: FAB_ROOM + insets.bottom }],
    [styles.content, insets.bottom],
  );
  return (
    <View style={frame}>
      <ScreenAppBar onBack={onBack} actions={actions}>
        <Text style={styles.title} numberOfLines={1}>
          {text.title}
        </Text>
      </ScreenAppBar>
      <View style={styles.body}>
        {listed ? (
          <SearchBar text={text} covered={menu.kind !== 'none'} />
        ) : null}
        <ScrollView
          style={styles.list}
          contentContainerStyle={content}
          keyboardShouldPersistTaps="handled"
        >
          <StatusCards />
          <LibraryBody
            view={view}
            state={state}
            menu={menu}
            onOpenStemSet={onOpenStemSet}
          />
        </ScrollView>
      </View>
      {listed ? (
        <FloatingActionButton
          variant="list"
          icon={text.fabIcon}
          accessibilityLabel={text.fabLabel}
          bottomInset={insets.bottom}
          onPress={startImport}
        />
      ) : null}
      <LibrarySheets menu={menu} bottomInset={insets.bottom} />
    </View>
  );
}

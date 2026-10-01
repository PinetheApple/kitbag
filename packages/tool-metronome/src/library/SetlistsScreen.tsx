import {
  AppBar,
  Badge,
  createThemedStyles,
  EmptyState,
  FloatingActionButton,
  ListRow,
  SearchField,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { useLibrary, type SetlistSummary } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import { setlistSubtitle } from '../logic/songSummary.ts';
import type { ShellMeasuredInsets } from '../screen/MetronomeScreen.tsx';
import { ScreenFrame } from './ScreenFrame.tsx';
import { SearchResultsList } from './SearchResultsList.tsx';
import {
  SetlistsSheets,
  useSetlistsMenu,
  type SetlistsMenu,
} from './SetlistsMenu.tsx';
import { useLibraryRefresh } from './useLibraryRefresh.ts';

const useStyles = createThemedStyles((theme) => ({
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.inlineKeyGap,
    marginTop: space.chipGap,
  },
  sectionLabel: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text2,
  },
}));

export interface SetlistsScreenProps {
  readonly insets: ShellMeasuredInsets;
  readonly onBack: () => void;
  readonly onOpenSetlist: (setlistId: number) => void;
  readonly onOpenAllSongs: () => void;
  readonly onLoaded: () => void;
}

interface SetlistRowProps {
  readonly summary: SetlistSummary;
  readonly menu: SetlistsMenu;
  readonly onOpen: (setlistId: number) => void;
}

function useSetlistRow({ summary, menu, onOpen }: SetlistRowProps) {
  const id = summary.setlist.id;
  const open = useCallback(() => {
    onOpen(id);
  }, [onOpen, id]);
  const actions = useCallback(() => {
    menu.openActions(id);
  }, [menu, id]);
  return { open, actions };
}

function SetlistRow(props: SetlistRowProps) {
  const played = useLibrary((s) => s.played.length);
  const { setlist, songCount, rampCount } = props.summary;
  const onStage = setlist.active;
  const subtitle = setlistSubtitle(
    songCount,
    rampCount,
    onStage ? played : undefined,
  );
  const { open, actions } = useSetlistRow(props);
  const stage = onStage ? ', on stage' : '';
  return (
    <ListRow
      icon={onStage ? 'practice' : 'songs'}
      title={setlist.name}
      subtitle={subtitle}
      active={onStage}
      accessibilityLabel={`${setlist.name}${stage}, ${subtitle}`}
      trailing={onStage ? <Badge tone="accent" label="ON STAGE" /> : undefined}
      onPress={open}
      onLongPress={actions}
    />
  );
}

function StandaloneSection({
  onOpenAllSongs,
}: {
  readonly onOpenAllSongs: () => void;
}) {
  const styles = useStyles();
  const count = useLibrary((s) => s.standalone.length);
  return (
    <>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Songs not in a setlist</Text>
        <Badge label={String(count)} />
      </View>
      <ListRow
        icon="song"
        title="All songs"
        subtitle="Standalone presets"
        onPress={onOpenAllSongs}
      />
    </>
  );
}

function SetlistList(
  props: SetlistsScreenProps & { readonly menu: SetlistsMenu },
) {
  const setlists = useLibrary((s) => s.setlists);
  const ready = useLibrary((s) => s.ready);
  if (ready && setlists.length === 0) {
    return (
      <EmptyState
        icon="songs"
        title="Make a setlist"
        reason="A setlist is the running order for a gig. Songs stay in All songs either way."
        actionLabel="Make a setlist"
        onAction={props.menu.openCreate}
      />
    );
  }
  return setlists.map((summary) => (
    <SetlistRow
      key={summary.setlist.id}
      summary={summary}
      menu={props.menu}
      onOpen={props.onOpenSetlist}
    />
  ));
}

function useQuery() {
  const [query, setQuery] = useState('');
  const search = useLibrary((s) => s.search);
  const onQuery = useCallback(
    (next: string) => {
      setQuery(next);
      void search(next);
    },
    [search],
  );
  const clear = useCallback(() => {
    setQuery('');
    void search('');
  }, [search]);
  return { query, onQuery, clear };
}

function Browse(props: SetlistsScreenProps & { readonly menu: SetlistsMenu }) {
  return (
    <>
      <SetlistList {...props} />
      <StandaloneSection onOpenAllSongs={props.onOpenAllSongs} />
    </>
  );
}

function SetlistsBody(
  props: SetlistsScreenProps & { readonly menu: SetlistsMenu },
) {
  const { query, onQuery, clear } = useQuery();
  return (
    <>
      <SearchField
        value={query}
        onChangeText={onQuery}
        placeholder="Search setlists & songs"
        accessibilityLabel="Search setlists and songs"
        onClear={clear}
      />
      {query.trim() === '' ? (
        <Browse {...props} />
      ) : (
        <SearchResultsList
          query={query}
          onClear={clear}
          onOpenSetlist={props.onOpenSetlist}
          onLoaded={props.onLoaded}
        />
      )}
    </>
  );
}

export function SetlistsScreen(props: SetlistsScreenProps) {
  useLibraryRefresh();
  const menu = useSetlistsMenu(props.onOpenSetlist);
  const header = <AppBar title="Setlists" onBack={props.onBack} />;
  const fab = (
    <FloatingActionButton
      icon="add"
      accessibilityLabel="New setlist"
      onPress={menu.openCreate}
    />
  );
  return (
    <ScreenFrame insets={props.insets} header={header} footer={fab}>
      <SetlistsBody {...props} menu={menu} />
      <SetlistsSheets menu={menu} bottomInset={props.insets.bottom} />
    </ScreenFrame>
  );
}

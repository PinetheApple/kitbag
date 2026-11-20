import { useLastTool, useSongLibrary, useStemDeck } from '@kitbag/core-state';
import { LibraryScreen } from '@kitbag/tool-library';
import {
  AddStemSongSheet,
  importCardShows,
  ImportStatusCard,
} from '@kitbag/tool-stems';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLibraryFolder } from '@/dataFolder/useLibraryFolder';
import { TOOL_ID } from '@/home/registry';
import { gated } from '@/home/ToolGate';
import { useLibraryRoutes } from '@/runtime/libraryRoutes';
import { useStemDeckRoutes } from '@/runtime/stemDeckRoutes';

function StemSongsRoute() {
  const insets = useSafeAreaInsets();
  const routes = useLibraryRoutes();
  const stemDeck = useStemDeckRoutes();
  const markUsed = useLastTool((s) => s.markUsed);
  const importStemFolder = useSongLibrary((s) => s.importStemFolder);
  const [adding, setAdding] = useState(false);
  const showImport = useStemDeck((s) => importCardShows(s.importView));
  const folder = useLibraryFolder('stems');

  useEffect(() => {
    markUsed(TOOL_ID.stems);
  }, [markUsed]);

  const openAdd = useCallback(() => {
    setAdding(true);
  }, []);
  const closeAdd = useCallback(() => {
    setAdding(false);
  }, []);
  const fromPhone = useCallback(() => {
    setAdding(false);
    void importStemFolder();
  }, [importStemFolder]);
  const fromStemDeck = useCallback(() => {
    setAdding(false);
    stemDeck.openConnect();
  }, [stemDeck]);

  return (
    <>
      <LibraryScreen
        view="stems"
        insets={insets}
        onBack={routes.back}
        onOpenStemSet={routes.openStemSet}
        onOpenSong={routes.openSong}
        onUnavailable={folder.showUnavailable}
        strip={folder.strip}
        onAdd={openAdd}
        {...(showImport
          ? { status: <ImportStatusCard onView={stemDeck.openImport} /> }
          : {})}
      />
      <AddStemSongSheet
        visible={adding}
        bottomInset={insets.bottom}
        onDismiss={closeAdd}
        onFromPhone={fromPhone}
        onFromStemDeck={fromStemDeck}
      />
      {folder.sheet}
    </>
  );
}

export default gated(TOOL_ID.stems, StemSongsRoute);

import { useLastTool, useSongLibrary, useStemDeck } from '@kitbag/core-state';
import { LibraryScreen } from '@kitbag/tool-library';
import { AddStemSongSheet, ImportStatusCard } from '@kitbag/tool-stems';
import { useCallback, useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const importing = useStemDeck((s) => s.importView?.running === true);

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
        onAdd={openAdd}
        {...(importing
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
    </>
  );
}

export default gated(TOOL_ID.stems, StemSongsRoute);

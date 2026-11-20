import { snackbar, Snackbar } from '@kitbag/core-design';
import type { LibraryView } from '@kitbag/core-state';
import { useCallback, useState, type ReactElement } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DataFolderSheets } from '../settings/DataFolderSheets.tsx';
import { useSettingsRoutes } from '../settings/settingsRoutes.ts';
import { useDataFolderSheets } from '../settings/useDataFolderSheets.ts';
import { CardMissingSheet } from './CardMissingSheet.tsx';
import { LibraryFolderStrip } from './LibraryFolderStrip.tsx';

export interface LibraryFolder {
  readonly strip: ReactElement;
  readonly sheet: ReactElement;
  readonly showUnavailable: () => void;
}

export function useLibraryFolder(view: LibraryView): LibraryFolder {
  const { openDataFolder } = useSettingsRoutes();
  const insets = useSafeAreaInsets();
  const [explaining, setExplaining] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const dataFolder = useDataFolderSheets(setNotice);
  const showUnavailable = useCallback(() => {
    setExplaining(true);
  }, []);
  const close = useCallback(() => {
    setExplaining(false);
  }, []);
  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);
  return {
    strip: (
      <LibraryFolderStrip
        view={view}
        onOpenDataFolder={openDataFolder}
        onFix={showUnavailable}
        onOfferReturn={dataFolder.offerReturn}
      />
    ),
    sheet: (
      <>
        <CardMissingSheet visible={explaining} onDismiss={close} />
        <DataFolderSheets model={dataFolder} media={null} />
        {notice === null ? null : (
          <Snackbar
            message={notice}
            bottom={insets.bottom + snackbar.aboveSheet}
            onTimeout={clearNotice}
          />
        )}
      </>
    ),
    showUnavailable,
  };
}

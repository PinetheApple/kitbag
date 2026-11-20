import type { LibraryView } from '@kitbag/core-state';
import { useCallback, useState, type ReactElement } from 'react';

import { useSettingsRoutes } from '../settings/settingsRoutes.ts';
import { CardMissingSheet } from './CardMissingSheet.tsx';
import { LibraryFolderStrip } from './LibraryFolderStrip.tsx';

export interface LibraryFolder {
  readonly strip: ReactElement;
  readonly sheet: ReactElement;
  readonly showUnavailable: () => void;
}

export function useLibraryFolder(view: LibraryView): LibraryFolder {
  const { openDataFolder } = useSettingsRoutes();
  const [explaining, setExplaining] = useState(false);
  const showUnavailable = useCallback(() => {
    setExplaining(true);
  }, []);
  const close = useCallback(() => {
    setExplaining(false);
  }, []);
  return {
    strip: (
      <LibraryFolderStrip
        view={view}
        onOpenDataFolder={openDataFolder}
        onFix={showUnavailable}
      />
    ),
    sheet: <CardMissingSheet visible={explaining} onDismiss={close} />,
    showUnavailable,
  };
}

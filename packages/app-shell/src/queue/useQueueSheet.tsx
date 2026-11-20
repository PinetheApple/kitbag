import {
  NoticeSnackbar,
  snackbar,
  useLeftSetlistNotice,
  useNotice,
} from '@kitbag/core-design';
import { useLibrary } from '@kitbag/core-state';
import { QueueSheet, type QueueSheetProps } from '@kitbag/tool-stems';
import { useCallback, useMemo, useState } from 'react';

import { useLibraryRoutes } from '@/runtime/libraryRoutes';

type PlayerRoutes = Pick<QueueSheetProps, 'onOpenStemSet' | 'onOpenSong'>;

export function useQueueSheet(bottomInset: number, player?: PlayerRoutes) {
  const routes = useLibraryRoutes();
  const notice = useNotice();
  const rejoinSetlist = useLibrary((s) => s.rejoinSetlist);
  const leftSetlist = useLeftSetlistNotice(notice, rejoinSetlist);
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => {
    setVisible(true);
  }, []);
  const close = useCallback(() => {
    setVisible(false);
  }, []);
  const sheetRoutes = useMemo(
    () => ({
      onOpenStemSet: player?.onOpenStemSet ?? routes.openStemSet,
      onOpenSong: player?.onOpenSong ?? routes.openSong,
      onOpenMetronome: routes.openMetronome,
      onNotice: notice.showMessage,
    }),
    [routes, player, notice.showMessage],
  );
  const sheet = (
    <>
      <QueueSheet
        {...sheetRoutes}
        playsInPlace={player === undefined}
        visible={visible}
        bottomInset={bottomInset}
        onDismiss={close}
        onLeftSetlist={leftSetlist}
      />
      <NoticeSnackbar
        notice={notice}
        bottom={bottomInset + snackbar.aboveSheet}
      />
    </>
  );
  return { open, sheet };
}

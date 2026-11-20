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

export interface QueueSheetPlace {
  readonly playsInPlace: boolean;
  readonly routes?: PlayerRoutes;
}

const IN_PLACE: QueueSheetPlace = { playsInPlace: true };

export function useQueueSheet(
  bottomInset: number,
  { playsInPlace, routes: player }: QueueSheetPlace = IN_PLACE,
) {
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
        playsInPlace={playsInPlace}
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

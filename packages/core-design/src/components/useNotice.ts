import { useCallback, useMemo, useState } from 'react';

export interface NoticeAction {
  readonly label: string;
  readonly onPress: () => void;
}

export interface NoticeContent {
  readonly message: string;
  readonly action?: NoticeAction;
}

interface ShownNotice extends NoticeContent {
  readonly at: number;
}

export function useNotice() {
  const [shown, setShown] = useState<ShownNotice | null>(null);
  const show = useCallback((content: NoticeContent) => {
    setShown({ ...content, at: Date.now() });
  }, []);
  const showMessage = useCallback(
    (message: string) => {
      show({ message });
    },
    [show],
  );
  const hide = useCallback(() => {
    setShown(null);
  }, []);
  return useMemo(
    () => ({ shown, show, showMessage, hide }),
    [shown, show, showMessage, hide],
  );
}

export type Notice = ReturnType<typeof useNotice>;

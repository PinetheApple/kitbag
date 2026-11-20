import { Snackbar, snackbar } from '@kitbag/core-design';
import { useCallback, useMemo, useState } from 'react';

export interface PlayerNoticeAction {
  readonly label: string;
  readonly onPress: () => void;
}

export interface PlayerNoticeContent {
  readonly message: string;
  readonly action?: PlayerNoticeAction;
}

interface ShownNotice extends PlayerNoticeContent {
  readonly at: number;
}

export function usePlayerNotice() {
  const [shown, setShown] = useState<ShownNotice | null>(null);
  const show = useCallback((content: PlayerNoticeContent) => {
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

export function PlayerNoticeSnackbar({
  notice,
}: {
  readonly notice: ReturnType<typeof usePlayerNotice>;
}) {
  const { shown, hide } = notice;
  if (shown === null) return null;
  const common = {
    message: shown.message,
    bottom: snackbar.aboveDock,
    onTimeout: hide,
  };
  if (shown.action === undefined)
    return <Snackbar key={shown.at} {...common} />;
  return (
    <Snackbar
      key={shown.at}
      {...common}
      actionLabel={shown.action.label}
      onAction={shown.action.onPress}
    />
  );
}

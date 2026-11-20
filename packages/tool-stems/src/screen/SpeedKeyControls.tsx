import { stemPlayer } from '@kitbag/core-design';
import { useStemPlayer } from '@kitbag/core-state';
import { useCallback, useState } from 'react';

import { SpeedKeyDock } from './SpeedKeyDock.tsx';
import { SpeedKeySheet } from './SpeedKeySheet.tsx';

const DOCK_GAPS = { top: stemPlayer.dockGap, bottom: stemPlayer.dockGap };

export function SpeedKeyControls({
  bottomInset,
}: {
  readonly bottomInset: number;
}) {
  const retiming = useStemPlayer((s) => s.retime.kind === 'recording');
  const [open, setOpen] = useState(false);
  const show = useCallback(() => {
    setOpen(true);
  }, []);
  const hide = useCallback(() => {
    setOpen(false);
  }, []);
  if (retiming) return null;
  return (
    <>
      <SpeedKeyDock gaps={DOCK_GAPS} onOpen={show} />
      <SpeedKeySheet visible={open} bottomInset={bottomInset} onClose={hide} />
    </>
  );
}

import { stemPlayer } from '@kitbag/core-design';
import { useStemPlayer } from '@kitbag/core-state';

import { SpeedKeyDock } from './SpeedKeyDock.tsx';

const DOCK_GAPS = { top: stemPlayer.dockGap, bottom: stemPlayer.dockGap };

export function SpeedKeyControls({ onOpen }: { readonly onOpen: () => void }) {
  const retiming = useStemPlayer((s) => s.retime.kind === 'recording');
  if (retiming) return null;
  return <SpeedKeyDock gaps={DOCK_GAPS} onOpen={onOpen} />;
}

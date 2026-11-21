import {
  createThemedStyles,
  NoticeSnackbar,
  PlayerScroll,
  snackbar,
  type Notice,
} from '@kitbag/core-design';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';

import { AdvanceCountIn } from './AdvanceCountIn.tsx';
import { ExportCancelledSnackbar } from './ExportNotice.tsx';
import { LoopUndoSnackbar } from './LoopUndoSnackbar.tsx';

export const OVERLAY_ID = 'player-overlay';

const useStyles = createThemedStyles(() => ({
  main: { flex: 1 },
  area: { flexGrow: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0 },
}));

export interface LayoutProps {
  readonly children: ReactNode;
  readonly dock: ReactNode;
  readonly onDockLayout: (event: LayoutChangeEvent) => void;
}

// Retiming pins its tap pad; a scroll around it would let the pad move.
export function RetimeLayout({ children, dock, onDockLayout }: LayoutProps) {
  const styles = useStyles();
  return (
    <>
      <View style={styles.main}>{children}</View>
      <View onLayout={onDockLayout}>{dock}</View>
    </>
  );
}

export function PlayerLayout({ children, dock, onDockLayout }: LayoutProps) {
  const styles = useStyles();
  return (
    <PlayerScroll>
      <View style={styles.area}>{children}</View>
      <View onLayout={onDockLayout}>{dock}</View>
    </PlayerScroll>
  );
}

export function useDockHeight() {
  const [dockHeight, setDockHeight] = useState(0);
  const onDockLayout = useCallback((event: LayoutChangeEvent) => {
    setDockHeight(event.nativeEvent.layout.height);
  }, []);
  return { dockHeight, onDockLayout };
}

interface PlayerOverlaysProps {
  readonly notice: Notice;
  readonly dockHeight: number;
}

export function PlayerOverlays({ notice, dockHeight }: PlayerOverlaysProps) {
  const styles = useStyles();
  const aboveDock = useMemo(() => ({ bottom: dockHeight }), [dockHeight]);
  return (
    <View
      testID={OVERLAY_ID}
      pointerEvents="box-none"
      style={[styles.overlay, aboveDock]}
    >
      <AdvanceCountIn />
      <LoopUndoSnackbar />
      <ExportCancelledSnackbar />
      <NoticeSnackbar notice={notice} bottom={snackbar.aboveDock} />
    </View>
  );
}

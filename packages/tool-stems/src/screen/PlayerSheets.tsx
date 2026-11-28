import type { AddedToSetlist, Notice, QueuePresses } from '@kitbag/core-design';
import type {
  MixerFrameValues,
  PlayOrderRoutes,
} from '@kitbag/core-plugin-api';
import type { LeftSetlist } from '@kitbag/core-state';

import { useStemsHost } from '../host.ts';
import { CLICK_SECTION, type ClickSection } from '../logic/clickView.ts';
import { ClickSheet } from './ClickSheet.tsx';
import { ExportSheet } from './ExportSheet.tsx';
import { PlayerMenu } from './PlayerMenu.tsx';
import { SetlistSheet } from './queueActions.tsx';
import { SpeedKeySheet } from './SpeedKeySheet.tsx';
import { StemMeterSheet } from './StemMeterSheet.tsx';
import { StemSetTempoSheet } from './StemSetTempo.tsx';
import { TempoSheet } from './TempoSheet.tsx';
import {
  clickSectionOf,
  TEMPO_SHEET,
  type OpenSheet,
} from './usePlayerSheet.ts';

export interface PlayerSheetsProps {
  readonly routes: PlayOrderRoutes;
  readonly notice: Notice;
  readonly queue: QueuePresses;
  readonly onAddToSetlist: () => void;
  readonly onAddedToSetlist: (added: AddedToSetlist) => void;
  readonly onLeftSetlist: (left: LeftSetlist) => void;
  readonly sheet: OpenSheet | null;
  readonly bottomInset: number;
  readonly frame: MixerFrameValues;
  readonly viewing: boolean;
  readonly onMeter: () => void;
  readonly onSetTempo: () => void;
  readonly onExport: () => void;
  readonly onTempo: () => void;
  readonly onClick: (section: ClickSection) => void;
  readonly onClose: () => void;
}

function OpenClickSheet({
  sheet,
  bottomInset,
  onClose,
}: Pick<PlayerSheetsProps, 'sheet' | 'bottomInset' | 'onClose'>) {
  const section = clickSectionOf(sheet);
  return (
    <ClickSheet
      visible={section !== null}
      section={section ?? CLICK_SECTION.grouping}
      bottomInset={bottomInset}
      onClose={onClose}
    />
  );
}

export function PlayerSheets(props: PlayerSheetsProps) {
  const { sheet, bottomInset, onClose } = props;
  const { QueueSheet } = useStemsHost().listening;
  return (
    <>
      <PlayerMenu
        visible={sheet === 'menu'}
        bottomInset={bottomInset}
        onClose={onClose}
        onMeter={props.onMeter}
        onSetTempo={props.onSetTempo}
        onExport={props.onExport}
        onTempo={props.onTempo}
        onClick={props.onClick}
        queue={props.queue}
        onAddToSetlist={props.onAddToSetlist}
      />
      <QueueSheet
        {...props.routes}
        playsInPlace={false}
        visible={sheet === 'upNext'}
        bottomInset={bottomInset}
        onDismiss={onClose}
        onLeftSetlist={props.onLeftSetlist}
        notice={props.notice}
      />
      <SetlistSheet
        visible={sheet === 'setlists'}
        bottomInset={bottomInset}
        onDismiss={onClose}
        onAdded={props.onAddedToSetlist}
      />
      <StemMeterSheet
        visible={sheet === 'meter'}
        bottomInset={bottomInset}
        playhead={props.frame.songSec}
        onClose={onClose}
      />
      {props.viewing ? null : (
        <StemSetTempoSheet
          visible={sheet === 'setTempo'}
          bottomInset={bottomInset}
          playhead={props.frame}
          onClose={onClose}
        />
      )}
      <TempoSheet
        visible={sheet === TEMPO_SHEET}
        bottomInset={bottomInset}
        onClose={onClose}
      />
      <OpenClickSheet {...props} />
      <ExportSheet
        visible={sheet === 'export'}
        bottomInset={bottomInset}
        onClose={onClose}
      />
      <SpeedKeySheet
        visible={sheet === 'speedKey'}
        bottomInset={bottomInset}
        onClose={onClose}
      />
    </>
  );
}

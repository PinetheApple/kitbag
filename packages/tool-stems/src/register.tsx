import type { ToolPlugin } from '@kitbag/core-plugin-api';
import type { ComponentType } from 'react';

import { StemsHostContext, type StemsHost } from './host.tsx';
import {
  StemPlayerScreen,
  type StemPlayerScreenProps,
} from './screen/StemPlayerScreen.tsx';

export interface StemsScreens {
  readonly player: ComponentType<StemPlayerScreenProps>;
}

export interface StemsPlugin extends ToolPlugin {
  readonly screens: StemsScreens;
}

export function register(host: StemsHost): StemsPlugin {
  function StemPlayer(props: StemPlayerScreenProps) {
    return (
      <StemsHostContext.Provider value={host}>
        <StemPlayerScreen {...props} />
      </StemsHostContext.Provider>
    );
  }
  return {
    id: 'stems',
    name: 'Stem songs',
    icon: 'stems',
    routes: [],
    screens: { player: StemPlayer },
  };
}

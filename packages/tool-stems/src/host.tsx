import type { Notice } from '@kitbag/core-design';
import type { ToolHost, ToolListening } from '@kitbag/core-plugin-api';
import type { LeftSetlist } from '@kitbag/core-state';
import { createContext, useContext } from 'react';

export type StemsHost = ToolHost<ToolListening<Notice, LeftSetlist>>;

const NO_HOST = 'Stem songs screens render inside the screen register() returns';

export const StemsHostContext = createContext<StemsHost | null>(null);

export function useStemsHost(): StemsHost {
  const host = useContext(StemsHostContext);
  if (host === null) throw new Error(NO_HOST);
  return host;
}

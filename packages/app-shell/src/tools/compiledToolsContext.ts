import { createContext, useContext } from 'react';

import type { CompiledTools } from '@/compiledTools';

const NO_TOOLS = 'useCompiledTools runs inside the root layout';

export const CompiledToolsContext = createContext<CompiledTools | null>(null);

export function useCompiledTools(): CompiledTools {
  const tools = useContext(CompiledToolsContext);
  if (tools === null) throw new Error(NO_TOOLS);
  return tools;
}

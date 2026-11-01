import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, type PropsWithChildren } from 'react';

import { useToolOn } from './toolsOn.ts';

export type ToolGateProps = PropsWithChildren<{ readonly toolId: string }>;

// Focus, not mount: a tool switched off under Settings leaves its screen in the
// stack, and it should not pull the user out of Settings.
export function ToolGate({ toolId, children }: ToolGateProps) {
  const on = useToolOn()(toolId);
  const router = useRouter();
  useFocusEffect(
    useCallback(() => {
      if (!on) router.dismissTo('/');
    }, [on, router]),
  );
  return on ? children : null;
}

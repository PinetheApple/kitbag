import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, type ComponentType } from 'react';

import { useToolOn } from './toolsOn.ts';

// Focus, not mount: a tool switched off under Settings leaves its screen in the
// stack, and it should not pull the user out of Settings.
export function gated(toolId: string, Body: ComponentType) {
  return function GatedRoute() {
    const on = useToolOn()(toolId);
    const router = useRouter();
    useFocusEffect(
      useCallback(() => {
        if (!on) router.dismissTo('/');
      }, [on, router]),
    );
    return on ? <Body /> : null;
  };
}

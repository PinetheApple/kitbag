import { getKitbagCommands } from './NativeKitbagCommands';
import type { OutputRoute } from './outputRouteTypes.ts';

export function getOutputRoute(): Promise<OutputRoute> {
  return getKitbagCommands().getOutputRoute();
}

export function watchOutputRoute(
  listener: (route: OutputRoute) => void,
): () => void {
  const commands = getKitbagCommands();
  let changed = false;
  let watching = true;
  const subscription = commands.onOutputRoute((route) => {
    changed = true;
    listener(route);
  });
  void commands.getOutputRoute().then((route) => {
    if (watching && !changed) listener(route);
  });
  return () => {
    watching = false;
    subscription.remove();
  };
}

import { getKitbagCommands } from './NativeKitbagCommands';
import type { OutputRoute } from './outputRouteTypes.ts';

const ignoreFailedRead = (): undefined => undefined;

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
  const deliverCurrent = (route: OutputRoute): void => {
    if (watching && !changed) listener(route);
  };
  void commands.getOutputRoute().then(deliverCurrent, ignoreFailedRead);
  return () => {
    watching = false;
    subscription.remove();
  };
}

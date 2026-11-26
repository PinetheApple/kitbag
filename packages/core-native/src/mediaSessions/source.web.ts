import type * as Native from './source.ts';

const ignore = (): undefined => undefined;

export const subscribeMediaSessions: typeof Native.subscribeMediaSessions = (
  listener,
) => {
  listener([]);
  return ignore;
};

export const mediaSessionCommand: typeof Native.mediaSessionCommand = ignore;

export const isNotificationListenerEnabled: typeof Native.isNotificationListenerEnabled =
  () => Promise.resolve(false);

export const openNotificationListenerSettings: typeof Native.openNotificationListenerSettings =
  ignore;

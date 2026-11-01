import {
  notificationAction,
  type NotificationAction,
  type NotificationStatus,
} from '@kitbag/core-state';

export const PLAYBACK_CARD_LABEL = 'Playback card';

const VALUE: Readonly<Record<NotificationAction, string>> = {
  none: 'On',
  request: 'Off',
  openSettings: 'Off · open settings',
};

export interface NotificationRow {
  readonly value: string | null;
  readonly action: NotificationAction;
}

export function notificationRow(
  status: NotificationStatus,
): NotificationRow | null {
  if (!status.required) return null;
  const action = notificationAction(status);
  return { value: status.granted === undefined ? null : VALUE[action], action };
}

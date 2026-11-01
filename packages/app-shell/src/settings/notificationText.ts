import {
  notificationAction,
  type NotificationAction,
  type NotificationStatus,
} from '@kitbag/core-state';

export const NOTIFICATIONS_LABEL = 'Notifications';

const ON = 'On';
const OFF = 'Off';

function valueOf(granted: boolean | undefined): string | null {
  if (granted === undefined) return null;
  return granted ? ON : OFF;
}

export interface NotificationRow {
  readonly value: string | null;
  readonly action: NotificationAction;
}

export function notificationRow(
  status: NotificationStatus,
): NotificationRow | null {
  if (!status.required) return null;
  return {
    value: valueOf(status.granted),
    action: notificationAction(status),
  };
}

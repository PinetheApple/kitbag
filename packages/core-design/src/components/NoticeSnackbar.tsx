import { Snackbar } from './Snackbar.tsx';
import type { Notice } from './useNotice.ts';

export interface NoticeSnackbarProps {
  readonly notice: Notice;
  readonly bottom: number;
}

export function NoticeSnackbar({ notice, bottom }: NoticeSnackbarProps) {
  const { shown, hide } = notice;
  if (shown === null) return null;
  const common = { message: shown.message, bottom, onTimeout: hide };
  if (shown.action === undefined)
    return <Snackbar key={shown.at} {...common} />;
  return (
    <Snackbar
      key={shown.at}
      {...common}
      actionLabel={shown.action.label}
      onAction={shown.action.onPress}
    />
  );
}

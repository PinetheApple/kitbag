import { Snackbar } from './Snackbar.tsx';
import type { Notice } from './useNotice.ts';

type NoticePlace =
  | { readonly bottom: number; readonly inline?: never }
  | { readonly inline: true; readonly bottom?: never };

export type NoticeSnackbarProps = NoticePlace & { readonly notice: Notice };

export function NoticeSnackbar({ notice, ...place }: NoticeSnackbarProps) {
  const { shown, hide } = notice;
  if (shown === null) return null;
  const common = { ...place, message: shown.message, onTimeout: hide };
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

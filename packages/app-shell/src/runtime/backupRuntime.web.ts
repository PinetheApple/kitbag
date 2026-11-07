import { configureBackup } from '@kitbag/core-state';

const unavailable = () =>
  Promise.reject(new Error('No backup on web; it needs the device'));

configureBackup({
  service: () => ({
    summary: unavailable,
    export: unavailable,
    exportSetlist: unavailable,
    plan: unavailable,
    apply: unavailable,
  }),
  pick: () => Promise.resolve(null),
  share: unavailable,
  afterRestore: () => Promise.resolve(),
});

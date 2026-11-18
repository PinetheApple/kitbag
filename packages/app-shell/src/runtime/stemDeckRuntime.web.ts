import { configureStemDeck } from '@kitbag/core-state';

const unavailable = () =>
  Promise.reject(new Error('No StemDeck import on web; it needs the device'));

configureStemDeck({
  native: {
    constants: () => {
      throw new Error('No StemDeck module on web');
    },
    probe: unavailable,
    trust: unavailable,
    forget: unavailable,
    knownServers: () => Promise.resolve([]),
    getJson: unavailable,
    startImport: unavailable,
    cancelImport: () => undefined,
    retryImport: unavailable,
    importSnapshot: unavailable,
    settleDownload: () => undefined,
    setWatching: () => undefined,
    scanQr: () => Promise.resolve(null),
    onImport: () => () => undefined,
  },
  unityNotice: { load: () => false, save: () => undefined },
  camera: {
    check: () => Promise.resolve('denied'),
    request: () => Promise.resolve('denied'),
    openSettings: () => undefined,
  },
});

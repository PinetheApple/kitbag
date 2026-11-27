import { useTheme } from '@kitbag/core-design';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ComponentType } from 'react';
import { Text } from 'react-native';

import { loadSpikeScreen, shippedSpikeLocation } from '@/spike/pluginLoader';
import { SpikeScreen, type SpikeScreenProps } from '@/spike/SpikeScreen';

const FLAG_ON = '1';

type LoadState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly screen: ComponentType<SpikeScreenProps> }
  | { readonly kind: 'failed'; readonly message: string };

interface SpikeParams {
  readonly control?: string;
  readonly hbc?: string;
  readonly src?: string;
  readonly starve?: string;
  readonly [key: string]: string | undefined;
}

function locationFor(hbc?: string, src?: string): string {
  return src ?? shippedSpikeLocation(hbc === FLAG_ON);
}

export default function PluginSpikeRoute() {
  const params = useLocalSearchParams<SpikeParams>();
  const theme = useTheme();
  const isControl = params.control === FLAG_ON;
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    if (isControl) return undefined;
    let live = true;
    const onReady = (screen: ComponentType<SpikeScreenProps>) => {
      if (live) setLoad({ kind: 'ready', screen });
    };
    const onFailed = (error: unknown) => {
      console.log(`KB_SPIKE load failed: ${String(error)}`);
      if (live) setLoad({ kind: 'failed', message: String(error) });
    };
    const location = locationFor(params.hbc, params.src);
    Promise.resolve(location).then(loadSpikeScreen).then(onReady, onFailed);
    return () => {
      live = false;
    };
  }, [isControl, params.hbc, params.src]);

  const screenProps: SpikeScreenProps = {
    variant: isControl
      ? 'control'
      : params.hbc === FLAG_ON
        ? 'plugin-hbc'
        : 'plugin-js',
    boxColor: theme.color.accent,
    textColor: theme.color.text,
    starve: params.starve === FLAG_ON,
  };

  if (isControl) return <SpikeScreen {...screenProps} />;
  if (load.kind === 'ready') return <load.screen {...screenProps} />;
  return (
    <Text style={{ color: theme.color.text }}>
      {load.kind === 'failed' ? load.message : 'loading'}
    </Text>
  );
}

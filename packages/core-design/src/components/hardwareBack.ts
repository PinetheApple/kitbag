import { BackHandler } from 'react-native';

export function onHardwareBack(handler: () => void): () => void {
  const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
    handler();
    return true;
  });
  return () => {
    subscription.remove();
  };
}

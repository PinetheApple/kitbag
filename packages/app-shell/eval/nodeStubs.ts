import { vi } from 'vitest';

// The core-state and core-design barrels reach these native modules, which do not
// load under node; a test that needs one mocks it itself.
vi.mock('react-native', () => ({}));
vi.mock('expo-haptics', () => ({}));
vi.mock('@op-engineering/op-sqlite', () => ({}));

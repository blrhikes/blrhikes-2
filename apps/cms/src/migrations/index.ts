import * as migration_20260226_180637 from './20260226_180637';
import * as migration_20260227_073927 from './20260227_073927';
import * as migration_20260301_000000 from './20260301_000000';
import * as migration_20260303_000000 from './20260303_000000';

export const migrations = [
  {
    up: migration_20260226_180637.up,
    down: migration_20260226_180637.down,
    name: '20260226_180637',
  },
  {
    up: migration_20260227_073927.up,
    down: migration_20260227_073927.down,
    name: '20260227_073927',
  },
  {
    up: migration_20260301_000000.up,
    down: migration_20260301_000000.down,
    name: '20260301_000000',
  },
  {
    up: migration_20260303_000000.up,
    down: migration_20260303_000000.down,
    name: '20260303_000000',
  },
];

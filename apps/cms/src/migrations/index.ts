import * as migration_20260424_131510 from './20260424_131510';
import * as migration_20260623_114757_add_raw_computed_driving_fields from './20260623_114757_add_raw_computed_driving_fields';

export const migrations = [
  {
    up: migration_20260424_131510.up,
    down: migration_20260424_131510.down,
    name: '20260424_131510',
  },
  {
    up: migration_20260623_114757_add_raw_computed_driving_fields.up,
    down: migration_20260623_114757_add_raw_computed_driving_fields.down,
    name: '20260623_114757_add_raw_computed_driving_fields'
  },
];

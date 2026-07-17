import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`trails\` ADD \`computed_driving_distance\` numeric;`)
  await db.run(sql`ALTER TABLE \`trails\` ADD \`computed_driving_time\` numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`trails\` DROP COLUMN \`computed_driving_distance\`;`)
  await db.run(sql`ALTER TABLE \`trails\` DROP COLUMN \`computed_driving_time\`;`)
}

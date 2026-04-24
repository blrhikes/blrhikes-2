import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Add straight-line distance from Bangalore centre, auto-calculated from GPX/GPS
  await db.run(sql`ALTER TABLE \`trails\` ADD \`distance_from_bangalore\` numeric;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`trails\` DROP COLUMN \`distance_from_bangalore\`;`)
}

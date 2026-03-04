import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Add the group's "type" column — default to 'url' for all existing rows that have a cover_image_url
  await db.run(sql`ALTER TABLE \`trails\` ADD \`cover_image_type\` text DEFAULT 'url';`)
  await db.run(
    sql`UPDATE \`trails\` SET \`cover_image_type\` = 'url' WHERE \`cover_image_url\` IS NOT NULL;`,
  )

  // Add the upload FK column for the "image" field in the group
  await db.run(
    sql`ALTER TABLE \`trails\` ADD \`cover_image_image_id\` integer REFERENCES media(id);`,
  )
  await db.run(
    sql`CREATE INDEX \`trails_cover_image_image_idx\` ON \`trails\` (\`cover_image_image_id\`);`,
  )
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP INDEX IF EXISTS \`trails_cover_image_image_idx\`;`)
  await db.run(sql`ALTER TABLE \`trails\` DROP COLUMN \`cover_image_image_id\`;`)
  await db.run(sql`ALTER TABLE \`trails\` DROP COLUMN \`cover_image_type\`;`)
}

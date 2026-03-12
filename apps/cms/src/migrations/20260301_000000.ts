import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // Add cover_image_url text column
  await db.run(sql`ALTER TABLE \`trails\` ADD \`cover_image_url\` text;`)

  // Copy any existing cover image URLs (best-effort: media table has url column)
  await db.run(sql`UPDATE \`trails\` SET \`cover_image_url\` = (
    SELECT \`url\` FROM \`media\` WHERE \`media\`.\`id\` = \`trails\`.\`cover_image_id\`
  ) WHERE \`cover_image_id\` IS NOT NULL;`)

  // SQLite doesn't support DROP COLUMN directly in older versions,
  // but D1 supports it. Drop the FK column and its index.
  await db.run(sql`DROP INDEX IF EXISTS \`trails_cover_image_idx\`;`)
  await db.run(sql`ALTER TABLE \`trails\` DROP COLUMN \`cover_image_id\`;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  // Re-add cover_image_id FK column
  await db.run(sql`ALTER TABLE \`trails\` ADD \`cover_image_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`trails_cover_image_idx\` ON \`trails\` (\`cover_image_id\`);`)

  // Drop cover_image_url
  await db.run(sql`ALTER TABLE \`trails\` DROP COLUMN \`cover_image_url\`;`)
}

import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`trails_photos\` RENAME TO \`trails_gallery\`;`)
  await db.run(sql`CREATE TABLE \`trails_sections_attachments\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` text NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`label\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`trails_sections\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`trails_sections_attachments_order_idx\` ON \`trails_sections_attachments\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`trails_sections_attachments_parent_id_idx\` ON \`trails_sections_attachments\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`trails_sections\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`heading\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`visibility\` text DEFAULT 'public' NOT NULL,
  	\`published\` integer DEFAULT true,
  	\`body\` text,
  	\`source_ref\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`trails\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`trails_sections_order_idx\` ON \`trails_sections\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`trails_sections_parent_id_idx\` ON \`trails_sections\` (\`_parent_id\`);`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_trails_gallery\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer NOT NULL,
  	\`caption\` text,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`trails\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_trails_gallery\`("_order", "_parent_id", "id", "image_id", "caption") SELECT "_order", "_parent_id", "id", "image_id", "caption" FROM \`trails_gallery\`;`)
  await db.run(sql`DROP TABLE \`trails_gallery\`;`)
  await db.run(sql`ALTER TABLE \`__new_trails_gallery\` RENAME TO \`trails_gallery\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`trails_gallery_order_idx\` ON \`trails_gallery\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`trails_gallery_parent_id_idx\` ON \`trails_gallery\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`trails_gallery_image_idx\` ON \`trails_gallery\` (\`image_id\`);`)
  await db.run(sql`ALTER TABLE \`trails_rels\` ADD \`gpx_files_id\` integer REFERENCES gpx_files(id);`)
  await db.run(sql`ALTER TABLE \`trails_rels\` ADD \`media_id\` integer REFERENCES media(id);`)
  await db.run(sql`CREATE INDEX \`trails_rels_gpx_files_id_idx\` ON \`trails_rels\` (\`gpx_files_id\`);`)
  await db.run(sql`CREATE INDEX \`trails_rels_media_id_idx\` ON \`trails_rels\` (\`media_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`ALTER TABLE \`trails_gallery\` RENAME TO \`trails_photos\`;`)
  await db.run(sql`DROP TABLE \`trails_sections_attachments\`;`)
  await db.run(sql`DROP TABLE \`trails_sections\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_trails_photos\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`image_id\` integer NOT NULL,
  	FOREIGN KEY (\`image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`trails\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_trails_photos\`("_order", "_parent_id", "id", "image_id") SELECT "_order", "_parent_id", "id", "image_id" FROM \`trails_photos\`;`)
  await db.run(sql`DROP TABLE \`trails_photos\`;`)
  await db.run(sql`ALTER TABLE \`__new_trails_photos\` RENAME TO \`trails_photos\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`trails_photos_order_idx\` ON \`trails_photos\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`trails_photos_parent_id_idx\` ON \`trails_photos\` (\`_parent_id\`);`)
  await db.run(sql`CREATE INDEX \`trails_photos_image_idx\` ON \`trails_photos\` (\`image_id\`);`)
  await db.run(sql`CREATE TABLE \`__new_trails_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`highlights_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`trails\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`highlights_id\`) REFERENCES \`highlights\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_trails_rels\`("id", "order", "parent_id", "path", "highlights_id") SELECT "id", "order", "parent_id", "path", "highlights_id" FROM \`trails_rels\`;`)
  await db.run(sql`DROP TABLE \`trails_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_trails_rels\` RENAME TO \`trails_rels\`;`)
  await db.run(sql`CREATE INDEX \`trails_rels_order_idx\` ON \`trails_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`trails_rels_parent_idx\` ON \`trails_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`trails_rels_path_idx\` ON \`trails_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`trails_rels_highlights_id_idx\` ON \`trails_rels\` (\`highlights_id\`);`)
}

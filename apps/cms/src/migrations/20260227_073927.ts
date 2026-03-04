import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`gpx_files\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric
  );
  `)
  await db.run(sql`CREATE INDEX \`gpx_files_updated_at_idx\` ON \`gpx_files\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`gpx_files_created_at_idx\` ON \`gpx_files\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`gpx_files_filename_idx\` ON \`gpx_files\` (\`filename\`);`)
  await db.run(sql`ALTER TABLE \`trails\` ADD \`gpx_file_id\` integer REFERENCES gpx_files(id);`)
  await db.run(sql`CREATE INDEX \`trails_gpx_file_idx\` ON \`trails\` (\`gpx_file_id\`);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`gpx_files_id\` integer REFERENCES gpx_files(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_gpx_files_id_idx\` ON \`payload_locked_documents_rels\` (\`gpx_files_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`gpx_files\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_trails\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`github_issue_number\` numeric,
  	\`alt_name\` text,
  	\`cover_image_id\` integer,
  	\`area_id\` integer,
  	\`gps\` text,
  	\`relative_location\` text,
  	\`is_local\` integer DEFAULT false,
  	\`rating\` numeric,
  	\`length\` numeric,
  	\`elevation_gain\` numeric,
  	\`elevation\` numeric,
  	\`difficulty\` text,
  	\`access\` text,
  	\`driving_distance\` numeric,
  	\`driving_distance_text\` text,
  	\`driving_time\` numeric,
  	\`driving_time_text\` text,
  	\`hiking_time\` numeric,
  	\`hiking_time_with_rests\` numeric,
  	\`hiking_time_with_exploration\` numeric,
  	\`map_link\` text,
  	\`content\` text,
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`cover_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`area_id\`) REFERENCES \`areas\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_trails\`("id", "title", "slug", "github_issue_number", "alt_name", "cover_image_id", "area_id", "gps", "relative_location", "is_local", "rating", "length", "elevation_gain", "elevation", "difficulty", "access", "driving_distance", "driving_distance_text", "driving_time", "driving_time_text", "hiking_time", "hiking_time_with_rests", "hiking_time_with_exploration", "map_link", "content", "status", "updated_at", "created_at") SELECT "id", "title", "slug", "github_issue_number", "alt_name", "cover_image_id", "area_id", "gps", "relative_location", "is_local", "rating", "length", "elevation_gain", "elevation", "difficulty", "access", "driving_distance", "driving_distance_text", "driving_time", "driving_time_text", "hiking_time", "hiking_time_with_rests", "hiking_time_with_exploration", "map_link", "content", "status", "updated_at", "created_at" FROM \`trails\`;`)
  await db.run(sql`DROP TABLE \`trails\`;`)
  await db.run(sql`ALTER TABLE \`__new_trails\` RENAME TO \`trails\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE UNIQUE INDEX \`trails_slug_idx\` ON \`trails\` (\`slug\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`trails_github_issue_number_idx\` ON \`trails\` (\`github_issue_number\`);`)
  await db.run(sql`CREATE INDEX \`trails_cover_image_idx\` ON \`trails\` (\`cover_image_id\`);`)
  await db.run(sql`CREATE INDEX \`trails_area_idx\` ON \`trails\` (\`area_id\`);`)
  await db.run(sql`CREATE INDEX \`trails_updated_at_idx\` ON \`trails\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`trails_created_at_idx\` ON \`trails\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`media_id\` integer,
  	\`areas_id\` integer,
  	\`highlights_id\` integer,
  	\`trails_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`areas_id\`) REFERENCES \`areas\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`highlights_id\`) REFERENCES \`highlights\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`trails_id\`) REFERENCES \`trails\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "media_id", "areas_id", "highlights_id", "trails_id") SELECT "id", "order", "parent_id", "path", "users_id", "media_id", "areas_id", "highlights_id", "trails_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_areas_id_idx\` ON \`payload_locked_documents_rels\` (\`areas_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_highlights_id_idx\` ON \`payload_locked_documents_rels\` (\`highlights_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_trails_id_idx\` ON \`payload_locked_documents_rels\` (\`trails_id\`);`)
}

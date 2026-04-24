import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`users_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`trails_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`trails_id\`) REFERENCES \`trails\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`users_rels_order_idx\` ON \`users_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`users_rels_parent_idx\` ON \`users_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`users_rels_path_idx\` ON \`users_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`users_rels_trails_id_idx\` ON \`users_rels\` (\`trails_id\`);`)
  await db.run(sql`CREATE TABLE \`payments\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`user_id\` integer NOT NULL,
  	\`plan\` text NOT NULL,
  	\`trail_id\` integer,
  	\`amount\` numeric NOT NULL,
  	\`status\` text DEFAULT 'pending' NOT NULL,
  	\`razorpay_order_id\` text NOT NULL,
  	\`razorpay_payment_id\` text,
  	\`razorpay_signature\` text,
  	\`membership_expires_at\` text,
  	\`notes\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`trail_id\`) REFERENCES \`trails\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`payments_user_idx\` ON \`payments\` (\`user_id\`);`)
  await db.run(sql`CREATE INDEX \`payments_trail_idx\` ON \`payments\` (\`trail_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`payments_razorpay_order_id_idx\` ON \`payments\` (\`razorpay_order_id\`);`)
  await db.run(sql`CREATE INDEX \`payments_updated_at_idx\` ON \`payments\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payments_created_at_idx\` ON \`payments\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`events\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`date\` text NOT NULL,
  	\`trail_id\` integer,
  	\`cover_image_id\` integer,
  	\`description\` text,
  	\`meeting_point\` text,
  	\`max_participants\` numeric,
  	\`registration_link\` text,
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`trail_id\`) REFERENCES \`trails\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`cover_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`events_slug_idx\` ON \`events\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`events_trail_idx\` ON \`events\` (\`trail_id\`);`)
  await db.run(sql`CREATE INDEX \`events_cover_image_idx\` ON \`events\` (\`cover_image_id\`);`)
  await db.run(sql`CREATE INDEX \`events_updated_at_idx\` ON \`events\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`events_created_at_idx\` ON \`events\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`blog\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`author_id\` integer,
  	\`published_at\` text,
  	\`cover_image_id\` integer,
  	\`excerpt\` text,
  	\`content\` text NOT NULL,
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`author_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`cover_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`blog_slug_idx\` ON \`blog\` (\`slug\`);`)
  await db.run(sql`CREATE INDEX \`blog_author_idx\` ON \`blog\` (\`author_id\`);`)
  await db.run(sql`CREATE INDEX \`blog_cover_image_idx\` ON \`blog\` (\`cover_image_id\`);`)
  await db.run(sql`CREATE INDEX \`blog_updated_at_idx\` ON \`blog\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`blog_created_at_idx\` ON \`blog\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`blog_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`trails_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`blog\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`trails_id\`) REFERENCES \`trails\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`blog_rels_order_idx\` ON \`blog_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`blog_rels_parent_idx\` ON \`blog_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`blog_rels_path_idx\` ON \`blog_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`blog_rels_trails_id_idx\` ON \`blog_rels\` (\`trails_id\`);`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_trails\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`title\` text NOT NULL,
  	\`slug\` text NOT NULL,
  	\`github_issue_number\` numeric,
  	\`alt_name\` text,
  	\`cover_image_type\` text DEFAULT 'url',
  	\`cover_image_url\` text,
  	\`cover_image_image_id\` integer,
  	\`area_id\` integer,
  	\`gps\` text,
  	\`distance_from_bangalore\` numeric,
  	\`relative_location\` text,
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
  	\`gpx_file_id\` integer,
  	\`content\` text,
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`cover_image_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`area_id\`) REFERENCES \`areas\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`gpx_file_id\`) REFERENCES \`gpx_files\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_trails\`("id", "title", "slug", "github_issue_number", "alt_name", "cover_image_type", "cover_image_url", "cover_image_image_id", "area_id", "gps", "distance_from_bangalore", "relative_location", "rating", "length", "elevation_gain", "elevation", "difficulty", "access", "driving_distance", "driving_distance_text", "driving_time", "driving_time_text", "hiking_time", "hiking_time_with_rests", "hiking_time_with_exploration", "map_link", "gpx_file_id", "content", "status", "updated_at", "created_at") SELECT "id", "title", "slug", "github_issue_number", "alt_name", "cover_image_type", "cover_image_url", "cover_image_image_id", "area_id", "gps", "distance_from_bangalore", "relative_location", "rating", "length", "elevation_gain", "elevation", "difficulty", "access", "driving_distance", "driving_distance_text", "driving_time", "driving_time_text", "hiking_time", "hiking_time_with_rests", "hiking_time_with_exploration", "map_link", "gpx_file_id", "content", "status", "updated_at", "created_at" FROM \`trails\`;`)
  await db.run(sql`DROP TABLE \`trails\`;`)
  await db.run(sql`ALTER TABLE \`__new_trails\` RENAME TO \`trails\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE UNIQUE INDEX \`trails_slug_idx\` ON \`trails\` (\`slug\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`trails_github_issue_number_idx\` ON \`trails\` (\`github_issue_number\`);`)
  await db.run(sql`CREATE INDEX \`trails_cover_image_cover_image_image_idx\` ON \`trails\` (\`cover_image_image_id\`);`)
  await db.run(sql`CREATE INDEX \`trails_area_idx\` ON \`trails\` (\`area_id\`);`)
  await db.run(sql`CREATE INDEX \`trails_gpx_file_idx\` ON \`trails\` (\`gpx_file_id\`);`)
  await db.run(sql`CREATE INDEX \`trails_updated_at_idx\` ON \`trails\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`trails_created_at_idx\` ON \`trails\` (\`created_at\`);`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`role\` text DEFAULT 'lifetime' NOT NULL;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`phone\` text;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`first_name\` text;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`membership_expires_at\` text;`)
  await db.run(sql`ALTER TABLE \`users\` ADD \`payment_source\` text;`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`payments_id\` integer REFERENCES payments(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`events_id\` integer REFERENCES events(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`blog_id\` integer REFERENCES blog(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_payments_id_idx\` ON \`payload_locked_documents_rels\` (\`payments_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_events_id_idx\` ON \`payload_locked_documents_rels\` (\`events_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_blog_id_idx\` ON \`payload_locked_documents_rels\` (\`blog_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`users_rels\`;`)
  await db.run(sql`DROP TABLE \`payments\`;`)
  await db.run(sql`DROP TABLE \`events\`;`)
  await db.run(sql`DROP TABLE \`blog\`;`)
  await db.run(sql`DROP TABLE \`blog_rels\`;`)
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
  	\`gpx_file_id\` integer,
  	\`content\` text,
  	\`status\` text DEFAULT 'draft' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`cover_image_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`area_id\`) REFERENCES \`areas\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`gpx_file_id\`) REFERENCES \`gpx_files\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`INSERT INTO \`__new_trails\`("id", "title", "slug", "github_issue_number", "alt_name", "cover_image_id", "area_id", "gps", "relative_location", "is_local", "rating", "length", "elevation_gain", "elevation", "difficulty", "access", "driving_distance", "driving_distance_text", "driving_time", "driving_time_text", "hiking_time", "hiking_time_with_rests", "hiking_time_with_exploration", "map_link", "gpx_file_id", "content", "status", "updated_at", "created_at") SELECT "id", "title", "slug", "github_issue_number", "alt_name", "cover_image_id", "area_id", "gps", "relative_location", "is_local", "rating", "length", "elevation_gain", "elevation", "difficulty", "access", "driving_distance", "driving_distance_text", "driving_time", "driving_time_text", "hiking_time", "hiking_time_with_rests", "hiking_time_with_exploration", "map_link", "gpx_file_id", "content", "status", "updated_at", "created_at" FROM \`trails\`;`)
  await db.run(sql`DROP TABLE \`trails\`;`)
  await db.run(sql`ALTER TABLE \`__new_trails\` RENAME TO \`trails\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE UNIQUE INDEX \`trails_slug_idx\` ON \`trails\` (\`slug\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`trails_github_issue_number_idx\` ON \`trails\` (\`github_issue_number\`);`)
  await db.run(sql`CREATE INDEX \`trails_cover_image_idx\` ON \`trails\` (\`cover_image_id\`);`)
  await db.run(sql`CREATE INDEX \`trails_area_idx\` ON \`trails\` (\`area_id\`);`)
  await db.run(sql`CREATE INDEX \`trails_gpx_file_idx\` ON \`trails\` (\`gpx_file_id\`);`)
  await db.run(sql`CREATE INDEX \`trails_updated_at_idx\` ON \`trails\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`trails_created_at_idx\` ON \`trails\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`__new_payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`users_id\` integer,
  	\`media_id\` integer,
  	\`gpx_files_id\` integer,
  	\`areas_id\` integer,
  	\`highlights_id\` integer,
  	\`trails_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`users_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`media_id\`) REFERENCES \`media\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`gpx_files_id\`) REFERENCES \`gpx_files\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`areas_id\`) REFERENCES \`areas\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`highlights_id\`) REFERENCES \`highlights\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`trails_id\`) REFERENCES \`trails\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`INSERT INTO \`__new_payload_locked_documents_rels\`("id", "order", "parent_id", "path", "users_id", "media_id", "gpx_files_id", "areas_id", "highlights_id", "trails_id") SELECT "id", "order", "parent_id", "path", "users_id", "media_id", "gpx_files_id", "areas_id", "highlights_id", "trails_id" FROM \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`ALTER TABLE \`__new_payload_locked_documents_rels\` RENAME TO \`payload_locked_documents_rels\`;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_gpx_files_id_idx\` ON \`payload_locked_documents_rels\` (\`gpx_files_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_areas_id_idx\` ON \`payload_locked_documents_rels\` (\`areas_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_highlights_id_idx\` ON \`payload_locked_documents_rels\` (\`highlights_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_trails_id_idx\` ON \`payload_locked_documents_rels\` (\`trails_id\`);`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`role\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`phone\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`first_name\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`membership_expires_at\`;`)
  await db.run(sql`ALTER TABLE \`users\` DROP COLUMN \`payment_source\`;`)
}

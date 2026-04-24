import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`payments\`;`)
  await db.run(sql`DROP TABLE \`events\`;`)
  await db.run(sql`DROP TABLE \`blog\`;`)
  await db.run(sql`DROP TABLE \`blog_rels\`;`)
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
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
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_users_id_idx\` ON \`payload_locked_documents_rels\` (\`users_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_media_id_idx\` ON \`payload_locked_documents_rels\` (\`media_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_gpx_files_id_idx\` ON \`payload_locked_documents_rels\` (\`gpx_files_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_areas_id_idx\` ON \`payload_locked_documents_rels\` (\`areas_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_highlights_id_idx\` ON \`payload_locked_documents_rels\` (\`highlights_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_trails_id_idx\` ON \`payload_locked_documents_rels\` (\`trails_id\`);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
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
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`payments_id\` integer REFERENCES payments(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`events_id\` integer REFERENCES events(id);`)
  await db.run(sql`ALTER TABLE \`payload_locked_documents_rels\` ADD \`blog_id\` integer REFERENCES blog(id);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_payments_id_idx\` ON \`payload_locked_documents_rels\` (\`payments_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_events_id_idx\` ON \`payload_locked_documents_rels\` (\`events_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_blog_id_idx\` ON \`payload_locked_documents_rels\` (\`blog_id\`);`)
}

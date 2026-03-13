import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-d1-sqlite'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Payments
  await db.run(sql`
    CREATE TABLE \`payments\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`user_id\` integer NOT NULL REFERENCES users(id),
      \`plan\` text NOT NULL,
      \`trail_id\` integer REFERENCES trails(id),
      \`amount\` numeric NOT NULL,
      \`status\` text DEFAULT 'pending' NOT NULL,
      \`razorpay_order_id\` text NOT NULL,
      \`razorpay_payment_id\` text,
      \`razorpay_signature\` text,
      \`membership_expires_at\` text,
      \`notes\` text,
      \`updated_at\` text NOT NULL,
      \`created_at\` text NOT NULL
    );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payments_razorpay_order_id_idx\` ON \`payments\` (\`razorpay_order_id\`);`)
  await db.run(sql`CREATE INDEX \`payments_user_idx\` ON \`payments\` (\`user_id\`);`)

  // Events
  await db.run(sql`
    CREATE TABLE \`events\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`title\` text NOT NULL,
      \`slug\` text NOT NULL,
      \`date\` text NOT NULL,
      \`trail_id\` integer REFERENCES trails(id),
      \`cover_image_id\` integer REFERENCES media(id),
      \`description\` text,
      \`meeting_point\` text,
      \`max_participants\` numeric,
      \`registration_link\` text,
      \`status\` text DEFAULT 'draft' NOT NULL,
      \`updated_at\` text NOT NULL,
      \`created_at\` text NOT NULL
    );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`events_slug_idx\` ON \`events\` (\`slug\`);`)

  // Blog
  await db.run(sql`
    CREATE TABLE \`blog\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`title\` text NOT NULL,
      \`slug\` text NOT NULL,
      \`author_id\` integer REFERENCES users(id),
      \`published_at\` text,
      \`cover_image_id\` integer REFERENCES media(id),
      \`excerpt\` text,
      \`content\` text NOT NULL,
      \`status\` text DEFAULT 'draft' NOT NULL,
      \`updated_at\` text NOT NULL,
      \`created_at\` text NOT NULL
    );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`blog_slug_idx\` ON \`blog\` (\`slug\`);`)

  // Blog ↔ Trails many-to-many
  await db.run(sql`
    CREATE TABLE \`blog_rels\` (
      \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      \`order\` integer,
      \`parent_id\` integer NOT NULL REFERENCES blog(id),
      \`path\` text NOT NULL,
      \`trails_id\` integer REFERENCES trails(id)
    );
  `)
  await db.run(sql`CREATE INDEX \`blog_rels_parent_idx\` ON \`blog_rels\` (\`parent_id\`);`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE IF EXISTS \`blog_rels\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`blog\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`events\`;`)
  await db.run(sql`DROP TABLE IF EXISTS \`payments\`;`)
}

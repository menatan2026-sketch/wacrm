// Applies SQL migrations in order and records them in ritmo_meta.
// Uses ADMIN_DATABASE_URL (an owner/superuser connection), never the
// app's runtime credentials.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../migrations');

export async function migrate(url = process.env.ADMIN_DATABASE_URL) {
  if (!url) throw new Error('ADMIN_DATABASE_URL is not set');
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await sql`create schema if not exists ritmo_meta`;
    await sql`create table if not exists ritmo_meta.migrations (name text primary key, applied_at timestamptz not null default now())`;
    const done = new Set((await sql<{ name: string }[]>`select name from ritmo_meta.migrations`).map((r) => r.name));
    const files = readdirSync(dir).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
    for (const file of files) {
      if (done.has(file)) continue;
      const body = readFileSync(join(dir, file), 'utf8');
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into ritmo_meta.migrations (name) values (${file})`;
      });
      console.log(`applied ${file}`);
    }
    if (process.env.RITMO_APP_PASSWORD) {
      await sql.unsafe(`alter role ritmo_app password '${process.env.RITMO_APP_PASSWORD.replace(/'/g, "''")}'`);
    }
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate().then(
    () => console.log('migrations up to date'),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}

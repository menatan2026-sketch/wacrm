// Local development only: wipes Ritmo's schemas and rebuilds them.
import postgres from 'postgres';
import { migrate } from './migrate';
import { seed } from './seed';

const url = process.env.ADMIN_DATABASE_URL;
if (!url) throw new Error('ADMIN_DATABASE_URL is not set');
const host = new URL(url).hostname;
if (!['127.0.0.1', 'localhost'].includes(host)) {
  console.error(`refusing to reset a non-local database (${host})`);
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql.unsafe('drop schema if exists ritmo cascade; drop schema if exists ritmo_auth cascade; drop schema if exists ritmo_meta cascade;');
await sql.end();
await migrate(url);
console.log(`demo company ready: ${await seed(url)}`);

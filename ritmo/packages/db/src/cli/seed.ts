// Creates (or rebuilds) the "Café Alma" demo company.
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

export async function seed(url = process.env.ADMIN_DATABASE_URL, ifMissing = false) {
  if (!url) throw new Error('ADMIN_DATABASE_URL is not set');
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    if (ifMissing) {
      const [existing] = await sql<{ id: string }[]>`select id from ritmo.organizations where is_demo limit 1`;
      if (existing) return existing.id;
    }
    const [row] = await sql<{ id: string }[]>`select ritmo.seed_demo() as id`;
    return row?.id;
  } finally {
    await sql.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  seed(process.env.ADMIN_DATABASE_URL, process.argv.includes('--if-missing')).then(
    (id) => console.log(`demo company ready: ${id}`),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}

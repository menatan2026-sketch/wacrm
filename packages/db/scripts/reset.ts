import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
if (process.env.NODE_ENV === "production") throw new Error("refusing to reset a production database");
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;");
await client.end();
console.log("database reset; run db:migrate && db:seed");

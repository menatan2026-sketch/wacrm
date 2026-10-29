import { createDb, createPool } from "@mfg/db";
import { seedDevelopment, seedReference } from "../src/seed";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const pool = createPool(url, 1);
const db = createDb(pool);
await seedReference(db);
if (process.argv.includes("--dev")) {
  if (process.env.NODE_ENV === "production")
    throw new Error("refusing to seed development accounts in production");
  await seedDevelopment(db);
}
await pool.end();
console.log("seed complete");

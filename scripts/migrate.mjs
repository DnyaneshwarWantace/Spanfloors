// Applies pending database migrations (drizzle/*.sql). Runs on every container start before the server.
import { createRequire } from "node:module";
const require = createRequire(process.env.NODE_PATH ? process.env.NODE_PATH + "/" : import.meta.url);
const { drizzle } = require("drizzle-orm/node-postgres");
const { migrate } = require("drizzle-orm/node-postgres/migrator");
const pg = require("pg");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
for (let attempt = 1; ; attempt++) {
  try {
    await pool.query("select 1");
    break;
  } catch (e) {
    if (attempt >= 30) throw e;
    console.log(`waiting for database (${attempt})…`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}
await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
console.log("database migrations up to date");
await pool.end();

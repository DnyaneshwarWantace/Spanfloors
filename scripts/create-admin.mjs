// Creates or resets an admin login on the server (runs inside the app container):
//   docker compose -f docker-compose.prod.yml exec app sh -c \
//     'NODE_PATH=/opt/migrate/node_modules node scripts/create-admin.mjs --email admin@spanfloors.com --name "Span Floors" --password "…"'
// Same password format as src/server/crypto.ts (scrypt N=16384, r=8, p=1, 64 bytes).
import { createRequire } from "node:module";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";

const require = createRequire(process.env.NODE_PATH ? process.env.NODE_PATH + "/" : import.meta.url);
const pg = require("pg");
const scrypt = promisify(scryptCb);

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const email = arg("email")?.trim().toLowerCase();
const name = arg("name") ?? "Admin";
const role = arg("role") === "editor" ? "editor" : "admin";
const password = arg("password");
if (!email || !password) {
  console.error("Usage: --email you@example.com --password '…' [--name 'Name'] [--role admin|editor]");
  process.exit(1);
}
if (password.length < 10) {
  console.error("Use a password of at least 10 characters.");
  process.exit(1);
}

const salt = randomBytes(16);
const key = await scrypt(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const hash = `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
const { rows } = await pool.query(
  `insert into users (email, name, role, password_hash) values ($1, $2, $3, $4)
   on conflict (email) do update set name = excluded.name, role = excluded.role, password_hash = excluded.password_hash, active = true, updated_at = now()
   returning (xmax = 0) as created`,
  [email, name, role, hash],
);
console.log(`${rows[0].created ? "Created" : "Updated"} ${role} ${email}`);
await pool.end();

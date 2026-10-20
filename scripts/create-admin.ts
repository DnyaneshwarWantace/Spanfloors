/**
 * Creates (or resets) an admin account.
 *   npm run admin:create -- --email you@example.com --name "Your Name" [--role admin|editor] [--password ...]
 * Without --password a strong one is generated and written to .env.local as INITIAL_ADMIN_PASSWORD.
 */
import { appendFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/db";
import { hashPassword, randomToken } from "../src/server/crypto";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  const email = arg("email")?.toLowerCase();
  const name = arg("name") ?? "Admin";
  const role = (arg("role") ?? "admin") as "admin" | "editor";
  if (!email) throw new Error("--email is required");
  let password = arg("password");
  const generated = !password;
  password ??= randomToken(12);

  const passwordHash = await hashPassword(password);
  const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, email));
  if (existing) {
    await db.update(schema.users).set({ passwordHash, role, name, active: true, updatedAt: new Date() }).where(eq(schema.users.id, existing.id));
    console.log(`Updated ${role} ${email}`);
  } else {
    await db.insert(schema.users).values({ email, name, role, passwordHash });
    console.log(`Created ${role} ${email}`);
  }
  if (generated) {
    appendFileSync(".env.local", `\n# First admin login (${email}). Change it after signing in, then delete this line.\nINITIAL_ADMIN_PASSWORD=${password}\n`);
    console.log("Password written to .env.local (INITIAL_ADMIN_PASSWORD).");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

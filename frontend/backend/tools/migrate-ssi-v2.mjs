/**
 * Migration: make Credential.age nullable + add isAdult boolean column.
 *
 * This enables full client-side SSI proving — /issuer/issue-vc no longer
 * persists the raw age; only the boolean adult status (age >= 18) is stored
 * server-side alongside the Ed25519-signed commitment.
 *
 * Run from the repo root: node backend/tools/migrate-ssi-v2.mjs
 */
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();

async function run() {
  try {
    console.log("Applying SSI v2 migration…");

    await client.query(`
      ALTER TABLE "Credential"
        ALTER COLUMN "age" DROP NOT NULL;
    `);
    console.log("✓ Credential.age is now nullable (INT → INT NULL)");

    await client.query(`
      ALTER TABLE "Credential"
        ADD COLUMN IF NOT EXISTS "isAdult" BOOLEAN;
    `);
    console.log("✓ Added Credential.isAdult BOOLEAN column");

    await client.query(`
      UPDATE "Credential"
        SET "isAdult" = ("age" >= 18)
      WHERE "age" IS NOT NULL AND "isAdult" IS NULL;
    `);
    console.log("✓ Back-filled isAdult for existing rows with stored age");

    console.log("\n✅ SSI v2 migration complete.");
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});

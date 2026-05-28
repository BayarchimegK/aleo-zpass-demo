// backend/tools/migrate-ssi.mjs
// Applies the SSI schema additions:
//   - holderDID column on Credential
//   - commitment column on Credential
//   - NullifierLog table
//
// Run from the repo root: node backend/tools/migrate-ssi.mjs
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();

try {
  console.log("Applying SSI migration…");

  await client.query(`
    ALTER TABLE "Credential"
      ADD COLUMN IF NOT EXISTS "holderDID"  TEXT,
      ADD COLUMN IF NOT EXISTS "commitment" TEXT;
  `);
  console.log("✓ Added holderDID, commitment to Credential");

  await client.query(`
    CREATE TABLE IF NOT EXISTS "NullifierLog" (
      "id"           TEXT         NOT NULL DEFAULT gen_random_uuid()::text,
      "nullifier"    TEXT         NOT NULL,
      "credentialId" INTEGER      NOT NULL,
      "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "NullifierLog_pkey"          PRIMARY KEY ("id"),
      CONSTRAINT "NullifierLog_nullifier_key" UNIQUE      ("nullifier")
    );
  `);
  console.log("✓ Created NullifierLog table");

  console.log("\n✅ SSI migration complete.");
} catch (err) {
  console.error("Migration failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}

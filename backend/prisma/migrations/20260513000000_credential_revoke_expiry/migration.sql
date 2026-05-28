-- AlterTable: add revocation and proof-expiry columns
ALTER TABLE "Credential"
  ADD COLUMN "isRevoked"      BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN "revokedAt"      TIMESTAMP(3),
  ADD COLUMN "proofExpiresAt" TIMESTAMP(3);

-- AlterTable: add proofTxId column to store the Aleo transaction ID of the ZK proof
ALTER TABLE "Credential" ADD COLUMN "proofTxId" TEXT;

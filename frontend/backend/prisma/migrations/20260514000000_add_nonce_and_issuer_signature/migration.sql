-- AddColumn: issuerSignature on Credential
ALTER TABLE "Credential" ADD COLUMN "issuerSignature" TEXT;

-- CreateTable: Nonce (one-time login tokens for replay-attack prevention)
CREATE TABLE "Nonce" (
    "id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique nonce value
CREATE UNIQUE INDEX "Nonce_value_key" ON "Nonce"("value");

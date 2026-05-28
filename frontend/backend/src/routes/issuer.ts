import { Router } from "express";
import {
  issueCredential,
  revokeCredential,
  listCredentials,
  getCredentialByEmail,
  deleteCredential,
} from "../services/credential.service";
import { prisma } from "../db/prisma";
import { getIssuerKeys, signData } from "../lib/issuerKeys";
import { AleoService } from "../services/aleo.service";

const router = Router();

router.post("/issue", async (req, res) => {
  try {
    const { holderEmail, age, country } = req.body;

    if (!holderEmail || !age || !country) {
      return res.status(400).json({
        message: "Missing fields",
      });
    }

    const credential = await issueCredential(holderEmail, age, country);

    return res.json({
      success: true,
      credential,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

router.post("/revoke/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid credential id" });
    }
    const credential = await revokeCredential(id);
    return res.json({ success: true, credential });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

router.get("/credentials", async (_req, res) => {
  try {
    const credentials = await listCredentials();
    return res.json({ success: true, credentials });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * DELETE /issuer/credentials/:id
 *
 * Permanently deletes a credential from the database. This is destructive
 * and removes the audit trail. Prefer using POST /issuer/revoke/:id for
 * normal revocation which preserves history.
 */
router.delete("/credentials/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid credential id" });
    }
    const credential = await deleteCredential(id);
    return res.json({ success: true, credential });
  } catch (err) {
    // Prisma returns a specific error when no record exists; surface 404.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("No record") || msg.includes("Record to delete")) {
      return res
        .status(404)
        .json({ success: false, error: "Credential not found" });
    }
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * GET /issuer/credential-by-email?email=...
 *
 * Returns the public credential ID (cid) for a given holder email.
 * Used by the frontend in Phase 2 so the Holder can look up their cid
 * before generating a ZK proof.  Age is never returned.
 */
router.get("/credential-by-email", async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, error: "email is required." });
    }

    const credential = await getCredentialByEmail(email);
    if (!credential) {
      return res
        .status(404)
        .json({ success: false, error: "No credential found for this email." });
    }

    // Only expose the public identifier — never expose age
    return res.json({
      success: true,
      cid: credential.id,
      isRevoked: credential.isRevoked,
      issuedAt: credential.issuedAt,
      country: credential.country,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * POST /issuer/issue-vc
 *
 * Privacy-preserving SSI credential issuance.
 *
 * isAdult is now DERIVED server-side from the ZK proof output — the client
 * must never supply a bare boolean that could be tampered with.
 *
 * Flow:
 *   1. Client computes commitment = SHA-256(age + ":" + holderDID) locally.
 *   2. Client generates a ZK proof that age >= 18 (via /proof/generate or
 *      @provablehq/sdk WASM — see frontend/lib/aleoProver.ts).
 *   3. Client POSTs { holderEmail, country, holderDID?, commitment, zkProof }.
 *   4. Server parses zkProof to derive isAdult (never trusts a client boolean).
 *   5. Server signs the commitment and returns the assembled VC fields.
 *
 * zkProof formats accepted:
 *   • Raw Leo CLI stdout  — output of `leo run prove_age_over_18 <age>u8`
 *   • WASM JSON           — { "outputs": ["true"], "method": "aleo-wasm" }
 *
 * Body:    { holderEmail, country, holderDID?, commitment: hex64, zkProof: string }
 * Response: { success, credentialId, issuerDID, holderDID, issuedAt,
 *             expiresAt, commitment, issuerSignature, isAdult }
 */
router.post("/issue-vc", async (req, res) => {
  try {
    const {
      holderEmail,
      country,
      zkProof,
      holderDID: reqHolderDID,
      commitment,
    } = req.body;

    if (!holderEmail || !country || !zkProof || !commitment) {
      return res.status(400).json({
        success: false,
        message: "Missing fields: holderEmail, country, zkProof, commitment",
      });
    }

    // commitment must be a 64-char lowercase hex string (SHA-256 output)
    if (typeof commitment !== "string" || !/^[0-9a-f]{64}$/.test(commitment)) {
      return res.status(400).json({
        success: false,
        message:
          "commitment must be a 64-character lowercase hex string (SHA-256).",
      });
    }

    if (typeof zkProof !== "string" || zkProof.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "zkProof must be a non-empty string.",
      });
    }

    // Derive isAdult from the ZK proof output — never trust a client boolean.
    const isAdult = AleoService.verifyProofOutput(zkProof);

    const { issuerDID } = getIssuerKeys();
    const effectiveHolderDID =
      reqHolderDID?.trim() ||
      `did:zpass:holder:${Buffer.from(holderEmail).toString("hex").slice(0, 32)}`;

    // 1. Persist credential — age is NEVER received or stored.
    //    isAdult is derived from the ZK proof, not from the client.
    const credential = await prisma.credential.create({
      data: { holderEmail, country, isAdult },
    });

    // 2. Sign the holder-supplied commitment with the issuer's Ed25519 key.
    //    commitment = SHA-256(age:holderDID) was computed entirely on the
    //    client; the server signs it without ever knowing the raw age.
    const issuerSignature = signData(commitment);

    // 3. Persist the SSI fields
    await prisma.credential.update({
      where: { id: credential.id },
      data: { holderDID: effectiveHolderDID, commitment, issuerSignature },
    });

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    return res.json({
      success: true,
      credentialId: credential.id,
      issuerDID,
      holderDID: effectiveHolderDID,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      commitment,
      issuerSignature,
      isAdult,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * GET /issuer/public-key
 *
 * Returns the issuer's DID and base-64 SPKI public key so the holder
 * (or any verifier) can independently verify the issuer's signature on a VC.
 */
router.get("/public-key", (_req, res) => {
  const { issuerDID, publicKeyPem } = getIssuerKeys();
  return res.json({
    issuerDID,
    publicKey: Buffer.from(publicKeyPem).toString("base64"),
    keyType: "Ed25519",
  });
});

export default router;

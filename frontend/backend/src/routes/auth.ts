import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { randomUUID, createHmac } from "crypto";
import rateLimit from "express-rate-limit";
import { prisma } from "../db/prisma";
import { AleoService } from "../services/aleo.service";
import { verifySignature } from "../lib/issuerKeys";

const router = Router();

// Phase 2 — max 5 verify attempts per IP per minute
const verifyLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many login attempts — try again in a minute.",
  },
});

// Short-lived sessions to minimise the revocation gap (Phase 3)
const JWT_TTL = "15m";

// Nonces expire after 5 minutes to prevent replay attacks
const NONCE_TTL_MS = 5 * 60 * 1000;

/**
 * GET /auth/nonce
 *
 * Phase 2, Step 1 — returns a single-use nonce the Holder must include
 * inside their ZK proof.  Nonces are stored in the DB and consumed on
 * first use, preventing proof-replay attacks.
 */
router.get("/nonce", async (_req: Request, res: Response) => {
  try {
    const value = randomUUID();
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS);

    await prisma.nonce.create({ data: { value, expiresAt } });

    res.json({ nonce: value });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * POST /auth/verify
 *
 * Phase 2, Steps 3–6 — validates the nonce, checks the Revocation
 * Registry BEFORE touching the ZK proof (fail-fast), then verifies the
 * proof and issues a short-lived JWT carrying the credentialId so the
 * Content Backend (Verifier) can re-check revocation on every request.
 *
 * Body: { email: string, nonce: string }
 *
 * The proof is generated server-side here for demo purposes; in
 * production the Holder would run Aleo's WASM SDK on their own device
 * and submit the opaque proof blob — the age never leaves the device.
 *
 * SSE event format:
 *   data: {"step":"...", "done":false}
 *   data: {"done":true, "token":"...", "isAdult":true}
 *   data: {"done":true, "error":"..."}
 */
router.post("/verify", verifyLimiter, async (req: Request, res: Response) => {
  const { email, nonce, commitment: clientCommitment, vcSignature } = req.body;

  if (!email || typeof email !== "string") {
    res.status(400).json({ success: false, error: "email is required." });
    return;
  }
  if (!nonce || typeof nonce !== "string") {
    res.status(400).json({ success: false, error: "nonce is required." });
    return;
  }

  // --- Set up SSE stream ---
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (payload: object) =>
    res.write(`data: ${JSON.stringify(payload)}\n\n`);

  try {
    // ── Step 1: validate nonce (replay-attack prevention) ──────────────
    send({ step: "Validating one-time nonce…", done: false });

    const nonceRecord = await prisma.nonce.findUnique({
      where: { value: nonce },
    });

    if (
      !nonceRecord ||
      nonceRecord.used ||
      nonceRecord.expiresAt < new Date()
    ) {
      send({
        done: true,
        error: "Nonce is invalid, expired, or already used. Please try again.",
      });
      res.end();
      return;
    }

    // Consume the nonce atomically — one-time use only
    await prisma.nonce.update({
      where: { value: nonce },
      data: { used: true },
    });

    // ── Step 2: look up credential ──────────────────────────────────────
    send({ step: "Looking up credential in the Registry…", done: false });

    const credential = await prisma.credential.findFirst({
      where: { holderEmail: email },
      orderBy: { issuedAt: "desc" },
    });

    if (!credential) {
      send({ done: true, error: "No credential found for this email." });
      res.end();
      return;
    }

    // ── Step 3: Revocation Registry check BEFORE the proof ─────────────
    // Fail-fast: never spend compute on revoked credentials.
    send({ step: "Checking Revocation Registry…", done: false });

    if (credential.isRevoked) {
      send({
        done: true,
        error:
          "Credential has been revoked by the Issuer. Contact them to re-issue.",
      });
      res.end();
      return;
    }

    // ── Step 4: proof / credential verification ─────────────────────────
    // We enforce SSI-only credentials. Legacy credentials that store raw
    // `age` on the server are rejected to maintain privacy guarantees.
    let isAdult: boolean;

    if (credential.age !== null) {
      send({
        done: true,
        error:
          "Legacy credentials are not accepted. Please re-issue using the SSI flow.",
      });
      res.end();
      return;
    }

    // ── SSI path ──────────────────────────────────────────────────────
    send({
      step: "Verifying Ed25519 credential signature (client-side SSI)…",
      done: false,
    });

    if (!clientCommitment || !vcSignature) {
      send({
        done: true,
        error:
          "SSI credential requires commitment and vcSignature in the request.",
      });
      res.end();
      return;
    }

    if (clientCommitment !== credential.commitment) {
      send({
        done: true,
        error: "Commitment mismatch — credential tampered.",
      });
      res.end();
      return;
    }

    const sigValid = verifySignature(credential.commitment!, vcSignature);
    if (!sigValid) {
      send({
        done: true,
        error: "Issuer signature verification failed — credential invalid.",
      });
      res.end();
      return;
    }

    // Use the isAdult derived at issuance time (server-derived from the
    // holder's original proof). The server never reconstructs raw age.
    isAdult = credential.isAdult ?? false;
    send({
      step: `Ed25519 signature verified — ${isAdult ? "adult" : "minor"} content access granted.`,
      done: false,
    });

    // ── Step 5: nullifier check (double-spend prevention) ────────────────
    // The nullifier ties a specific credential to a specific nonce so that
    // capturing this verify request cannot be replayed even if the nonce
    // table were somehow manipulated.
    const nullifier = createHmac("sha256", process.env.JWT_SECRET as string)
      .update(`${credential.id}:${nonce}`)
      .digest("hex");

    const existingNullifier = await prisma.nullifierLog.findUnique({
      where: { nullifier },
    });
    if (existingNullifier) {
      send({
        done: true,
        error:
          "This proof session was already consumed. Please start a new login.",
      });
      res.end();
      return;
    }
    await prisma.nullifierLog.create({
      data: { nullifier, credentialId: credential.id },
    });

    // ── Step 6: issue short-lived JWT (15 min) ──────────────────────────
    // isAdult drives content gating in the Content Backend.
    // credentialId enables real-time revocation checks on every request.
    // holderDID links the session to the holder's SSI identity.
    const token = jwt.sign(
      {
        credentialId: credential.id,
        email: credential.holderEmail,
        isAdult,
        holderDID: credential.holderDID ?? null,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: JWT_TTL },
    );

    send({ done: true, token, isAdult });
    res.end();
  } catch (err) {
    send({
      done: true,
      error: err instanceof Error ? err.message : String(err),
    });
    res.end();
  }
});

/**
 * GET /auth/check-revocation/:credentialId
 *
 * Phase 3 — internal endpoint consumed by the Content Backend (Verifier)
 * to perform a real-time Revocation Registry check on every protected
 * request.  This closes the revocation gap that short-lived JWTs still
 * leave open between re-issuances.
 *
 * Returns: { revoked: boolean }
 */
router.get(
  "/check-revocation/:credentialId",
  async (req: Request, res: Response) => {
    const id = Number(req.params.credentialId);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: "Invalid credential ID." });
      return;
    }

    const credential = await prisma.credential.findUnique({
      where: { id },
      select: { isRevoked: true },
    });

    // Unknown credentials are treated as revoked — deny by default
    res.json({ revoked: !credential || credential.isRevoked });
  },
);

export default router;

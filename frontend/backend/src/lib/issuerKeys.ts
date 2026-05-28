import {
  generateKeyPairSync,
  sign,
  verify,
  createPrivateKey,
  createPublicKey,
  createHash,
} from "crypto";

interface IssuerKeys {
  privateKeyPem: string;
  publicKeyPem: string;
  issuerDID: string;
}

let _keys: IssuerKeys | null = null;

/**
 * Initialise the issuer Ed25519 key pair.
 *
 * Reads from env (base-64 encoded PEM):
 *   ISSUER_PRIVATE_KEY_PEM – PKCS#8 private key
 *   ISSUER_PUBLIC_KEY_PEM  – SPKI public key
 *
 * If the env vars are absent a fresh key pair is generated and the
 * base-64 values are printed so they can be persisted in backend/.env.
 * Ephemeral keys work for a single run but make existing VCs unverifiable
 * after restart.
 */
export function initIssuerKeys(): IssuerKeys {
  if (_keys) return _keys;

  const envPriv = process.env.ISSUER_PRIVATE_KEY_PEM;
  const envPub = process.env.ISSUER_PUBLIC_KEY_PEM;

  if (envPriv && envPub) {
    const privateKeyPem = Buffer.from(envPriv, "base64").toString("utf-8");
    const publicKeyPem = Buffer.from(envPub, "base64").toString("utf-8");
    const pubDer = createPublicKey(publicKeyPem).export({
      type: "spki",
      format: "der",
    });
    const issuerDID = `did:zpass:issuer:${createHash("sha256")
      .update(pubDer)
      .digest("hex")
      .slice(0, 32)}`;
    _keys = { privateKeyPem, publicKeyPem, issuerDID };
    console.log(`[Issuer] Loaded persistent DID: ${issuerDID}`);
  } else {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const privateKeyPem = privateKey.export({
      type: "pkcs8",
      format: "pem",
    }) as string;
    const publicKeyPem = publicKey.export({
      type: "spki",
      format: "pem",
    }) as string;
    const pubDer = publicKey.export({ type: "spki", format: "der" });
    const issuerDID = `did:zpass:issuer:${createHash("sha256")
      .update(pubDer)
      .digest("hex")
      .slice(0, 32)}`;
    _keys = { privateKeyPem, publicKeyPem, issuerDID };

    console.warn(
      "[Issuer] ⚠️  No ISSUER_PRIVATE_KEY_PEM in .env — ephemeral Ed25519 key pair generated.",
    );
    console.warn(
      "[Issuer]    Existing VCs will become unverifiable after restart.",
    );
    console.warn("[Issuer]    Add these to backend/.env to persist:");
    console.warn(
      `    ISSUER_PRIVATE_KEY_PEM=${Buffer.from(privateKeyPem).toString("base64")}`,
    );
    console.warn(
      `    ISSUER_PUBLIC_KEY_PEM=${Buffer.from(publicKeyPem).toString("base64")}`,
    );
    console.warn(`    ISSUER_DID=${issuerDID}`);
  }

  return _keys;
}

export function getIssuerKeys(): IssuerKeys {
  if (!_keys) initIssuerKeys();
  return _keys!;
}

/** Sign arbitrary UTF-8 data with the issuer's Ed25519 private key. Returns base-64. */
export function signData(data: string): string {
  const { privateKeyPem } = getIssuerKeys();
  const privKey = createPrivateKey(privateKeyPem);
  return sign(null, Buffer.from(data, "utf-8"), privKey).toString("base64");
}

/** Verify a base-64 Ed25519 signature produced by signData(). */
export function verifySignature(data: string, signature: string): boolean {
  try {
    const { publicKeyPem } = getIssuerKeys();
    const pubKey = createPublicKey(publicKeyPem);
    return verify(
      null,
      Buffer.from(data, "utf-8"),
      pubKey,
      Buffer.from(signature, "base64"),
    );
  } catch {
    return false;
  }
}

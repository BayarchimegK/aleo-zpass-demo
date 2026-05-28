/**
 * ZPass Holder Wallet — localStorage-based SSI credential store.
 *
 * Stores Verifiable Credentials issued by the ZPass Issuer.
 * The holder's DID is generated once from a random 16-byte seed and
 * persisted alongside their credentials.
 *
 * Production note: replace localStorage with IndexedDB and add AES-GCM
 * encryption (PBKDF2-derived key from a wallet passphrase) before deploying.
 */

export interface VerifiableCredential {
  /** Numeric ID of the credential row on the issuer's server */
  credentialId: number;
  /** Holder email — used for wallet lookup by login page */
  holderEmail: string;
  /** Issuer's DID (did:zpass:issuer:<hex>) */
  issuerDID: string;
  /** Holder's DID (did:zpass:holder:<hex>) */
  holderDID: string;
  issuedAt: string;
  expiresAt: string;
  claims: {
    age: number;
    country: string;
  };
  /** SHA-256 hex commitment over (age:holderDID) — computed client-side;
   *  the server never receives the raw age, only this hash. */
  commitment: string;
  proof: {
    type: string;
    created: string;
    verificationMethod: string;
    /** Base-64 Ed25519 signature of the commitment by the issuer */
    signature: string;
  };
}

interface WalletStore {
  /** Holder's self-sovereign DID */
  holderDID: string;
  createdAt: string;
  credentials: VerifiableCredential[];
}

const WALLET_KEY = "zpass_wallet_v1";

function load(): WalletStore | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(WALLET_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WalletStore;
  } catch {
    return null;
  }
}

function save(store: WalletStore): void {
  localStorage.setItem(WALLET_KEY, JSON.stringify(store));
}

/** Generate a new self-sovereign DID from 16 random bytes. */
export function generateHolderDID(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `did:zpass:holder:${hex}`;
}

/** Return the existing wallet, or create one with a fresh DID. */
export function getOrCreateWallet(): WalletStore {
  const existing = load();
  if (existing) return existing;
  const store: WalletStore = {
    holderDID: generateHolderDID(),
    createdAt: new Date().toISOString(),
    credentials: [],
  };
  save(store);
  return store;
}

export function getWallet(): WalletStore | null {
  return load();
}

/** The holder's DID string (creates wallet if none exists). */
export function getHolderDID(): string {
  return getOrCreateWallet().holderDID;
}

/**
 * Import a VC into the wallet.  If a VC with the same credentialId already
 * exists it is replaced (handles re-issuance).
 */
export function importVC(vc: VerifiableCredential): void {
  const store = getOrCreateWallet();
  const idx = store.credentials.findIndex(
    (c) => c.credentialId === vc.credentialId,
  );
  if (idx >= 0) {
    store.credentials[idx] = vc;
  } else {
    store.credentials.push(vc);
  }
  save(store);
}

/** Find a VC by the holder's email address (case-insensitive). */
export function getVCByEmail(email: string): VerifiableCredential | null {
  const store = load();
  if (!store) return null;
  return (
    store.credentials.find(
      (vc) => vc.holderEmail.toLowerCase() === email.toLowerCase(),
    ) ?? null
  );
}

/** Find a VC by its numeric credential ID. */
export function getVCById(id: number): VerifiableCredential | null {
  const store = load();
  if (!store) return null;
  return store.credentials.find((vc) => vc.credentialId === id) ?? null;
}

/** All VCs currently in the wallet. */
export function listVCs(): VerifiableCredential[] {
  return load()?.credentials ?? [];
}

/** Remove a specific VC from the wallet. */
export function deleteVC(credentialId: number): void {
  const store = load();
  if (!store) return;
  store.credentials = store.credentials.filter(
    (vc) => vc.credentialId !== credentialId,
  );
  save(store);
}

/** Export the entire wallet as a pretty-printed JSON string for backup. */
export function exportWalletJSON(): string {
  return JSON.stringify(load(), null, 2);
}

/**
 * Replace the current wallet with one imported from a JSON string.
 * Returns { ok: true } on success or { ok: false, error } on failure.
 */
export function importWalletJSON(json: string): {
  ok: boolean;
  error?: string;
} {
  try {
    const parsed = JSON.parse(json) as WalletStore;
    if (!parsed.holderDID || !Array.isArray(parsed.credentials)) {
      return {
        ok: false,
        error: "Invalid wallet format (missing holderDID or credentials).",
      };
    }
    save(parsed);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Invalid JSON — could not parse wallet backup.",
    };
  }
}

/** Wipe the entire wallet from localStorage. */
export function clearWallet(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(WALLET_KEY);
  }
}

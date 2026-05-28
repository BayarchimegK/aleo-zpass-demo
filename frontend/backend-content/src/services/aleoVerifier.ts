/**
 * aleoVerifier.ts
 *
 * Verifies a proof transaction ID against the Aleo network.
 * Fetches the transaction from the explorer API and confirms:
 *   1. The transaction exists and is finalized.
 *   2. It executed the expected program/function.
 *   3. The public output is `true` (age >= 18 passed).
 *
 * Results are cached in-memory for CACHE_TTL_MS to avoid hammering the API
 * on every content request.
 */

const ALEO_ENDPOINT =
  process.env.ALEO_ENDPOINT || "https://api.explorer.provable.com/v1";
const NETWORK = process.env.NETWORK || "testnet";
const EXPECTED_PROGRAM = "leo.aleo";
const EXPECTED_FUNCTION = "prove_age_over_18";

// 30-minute in-memory cache per txId
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CacheEntry {
  result: boolean;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

/**
 * Returns true if the Aleo tx proves age >= 18, false otherwise.
 * Throws if the network is unreachable or the tx is not found.
 */
export async function verifyProofOnChain(txId: string): Promise<boolean> {
  console.log("txId of verifyProofOnChain: ", txId);
  // Sanitize: Aleo tx IDs start with "at1" and are alphanumeric
  if (!/^at1[a-z0-9]+$/.test(txId)) {
    throw new Error("Invalid transaction ID format.");
  }

  const cached = cache.get(txId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const url = `${ALEO_ENDPOINT}/${NETWORK}/transaction/${encodeURIComponent(txId)}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Aleo API returned ${response.status} for tx ${txId}`);
  }

  const tx = (await response.json()) as Record<string, unknown>;

  // Navigate the Aleo transaction structure:
  // tx.execution.transitions[0].program == "leo.aleo"
  // tx.execution.transitions[0].function == "prove_age_over_18"
  // tx.execution.transitions[0].outputs[0].value == "true"
  const transitions: unknown[] = (tx as any)?.execution?.transitions ?? [];

  const transition = transitions[0] as any;

  if (
    !transition ||
    transition.program !== EXPECTED_PROGRAM ||
    transition.function !== EXPECTED_FUNCTION
  ) {
    throw new Error("Transaction does not match expected program/function.");
  }

  const outputValue: string = transition?.outputs?.[0]?.value ?? "";

  // Public output is "true" (adult) or "false" (minor)
  const result = outputValue.trim() === "true";

  cache.set(txId, { result, expiresAt: Date.now() + CACHE_TTL_MS });

  return result;
}

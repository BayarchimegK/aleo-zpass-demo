import { executeLeoProof, extractTxId } from "./leo.exec";

/**
 * Parses a zkProof string and returns whether the prover claimed isAdult=true.
 *
 * Accepts two formats:
 *   1. Raw Leo CLI stdout  — produced by `leo run prove_age_over_18 <age>u8`
 *      Contains "• true" or "• false" in the Output section.
 *   2. WASM JSON           — produced by @provablehq/sdk ProgramManager.run()
 *      Shape: { "outputs": ["true"], "method": "aleo-wasm" }
 *
 * The server DERIVES isAdult from the proof output; it never trusts a bare
 * boolean supplied by the client.
 */
function parseProofOutput(zkProof: string): boolean {
  // Try WASM JSON format first
  try {
    const parsed: unknown = JSON.parse(zkProof);
    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "outputs" in parsed &&
      Array.isArray((parsed as { outputs: unknown }).outputs)
    ) {
      const outputs = (parsed as { outputs: unknown[] }).outputs;
      return outputs[0] === "true";
    }
  } catch {
    // Not JSON — fall through to raw CLI parsing
  }

  // Raw Leo CLI stdout patterns
  return (
    /•\s*true\b/i.test(zkProof) ||
    /\boutput\b[\s\S]*?\btrue\b/i.test(zkProof) ||
    /^\s*true\s*$/m.test(zkProof)
  );
}

export const AleoService = {
  generateProof: async (age: number) => {
    const raw = await executeLeoProof(age);
    const txId = extractTxId(raw);

    // `leo run` output contains "• true" or "• false" in the Output section.
    // We also accept bare "true" to be safe against formatting changes.
    const valid = parseProofOutput(raw);

    return {
      valid,
      txId: txId ?? null,
      raw,
    };
  },

  /**
   * Verifies a zkProof string (CLI stdout or WASM JSON) and returns isAdult.
   * Used by /issuer/issue-vc so isAdult is always server-derived, never
   * trusted from a client-supplied boolean.
   */
  verifyProofOutput(zkProof: string): boolean {
    return parseProofOutput(zkProof);
  },
};

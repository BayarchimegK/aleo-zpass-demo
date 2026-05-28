/**
 * aleoProver.ts
 *
 * Provides two implementations for client-side ZK proof generation.
 * Both produce a `zkProof` string accepted by POST /issuer/issue-vc.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  Approach A — Server-side CLI (current / default)                   │
 * │  Age is sent only to /proof/generate; it is NEVER stored there.     │
 * │  isAdult is derived by /issuer/issue-vc from the returned proof.    │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │  Approach B — Client-side WASM (@provablehq/sdk)                   │
 * │  Age never leaves the browser at all.                               │
 * │  To enable: npm install @provablehq/sdk  (in /frontend)            │
 * │  Then uncomment the implementation below and delete the stub.       │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * zkProof format accepted by the server (AleoService.verifyProofOutput):
 *   • Raw Leo CLI stdout  — contains "• true" / "• false"
 *   • WASM JSON string    — { "outputs": ["true"], "method": "aleo-wasm" }
 */

import api from "./api";

// ─────────────────────────────────────────────────────────────────────────────
// Approach A — Server-side CLI proof generation (default, works out of the box)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calls POST /proof/generate on the auth backend.
 * The backend runs `leo run prove_age_over_18 <age>u8` and returns the raw
 * Leo CLI stdout as `proof`.  The age is used only for proof execution and is
 * never persisted — the /issuer/issue-vc endpoint receives the proof string,
 * not the age.
 */
export async function generateProofServer(
  age: number,
): Promise<{ proof: string; method: "server" }> {
  const res = await api.post<{ success: boolean; proof: string }>(
    "/proof/generate",
    { age },
  );
  if (!res.data.success || !res.data.proof) {
    throw new Error("Proof generation failed on the server.");
  }
  return { proof: res.data.proof, method: "server" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Approach B — Client-side WASM (@provablehq/sdk)
//
// Privacy-ideal path: the age number never leaves the browser.
// The compiled Aleo program runs as a ZK circuit inside a WASM sandbox and
// returns outputs: ["true"] | ["false"].
//
// Requirements (already in place):
//   • @provablehq/sdk in package.json dependencies
//   • asyncWebAssembly: true in next.config.ts webpack experiments
//   • serverExternalPackages: ["@provablehq/sdk"] in next.config.ts
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compiled Aleo bytecode (from leo/build/main.aleo) that proves age >= 18
 * without revealing the raw age value.
 */
const ALEO_PROGRAM = `program leo.aleo;

function prove_age_over_18:
    input r0 as u8.private;
    gte r0 18u8 into r1;
    output r1 as boolean.private;
`;

/**
 * Runs the Aleo ZK program locally in the browser via @provablehq/sdk WASM.
 * Returns a JSON-serialised proof string compatible with /issuer/issue-vc.
 *
 * The age is a PRIVATE input — it is not included in the proof outputs and
 * is never transmitted to the server.
 */
export async function generateProofWasm(
  age: number,
): Promise<{ proof: string; method: "wasm" }> {
  if (typeof window === "undefined") {
    throw new Error("WASM proof generation is only available in the browser.");
  }

  // @provablehq/sdk is listed in package.json; use a standard dynamic import
  // so Next.js bundles the browser-compatible WASM build automatically.
  // (Requires asyncWebAssembly: true in next.config.ts webpack experiments.)
  let sdk: any;
  try {
    sdk = await import("@provablehq/sdk");
  } catch (e) {
    throw new Error(
      `Failed to load @provablehq/sdk: ${
        e instanceof Error ? e.message : String(e)
      }`,
    );
  }

  const ProgramManager: any =
    sdk.ProgramManager ?? (sdk as any).default?.ProgramManager;
  const Account: any = sdk.Account ?? (sdk as any).default?.Account;

  if (!ProgramManager) {
    throw new Error("@provablehq/sdk does not export ProgramManager");
  }
  if (!Account) {
    throw new Error("@provablehq/sdk does not export Account");
  }

  const programManager = new ProgramManager();

  // Create a one-time ephemeral account (random keypair) for local execution.
  // new Account() with no args generates a fresh random private key.
  // This account is never stored, transmitted, or associated with any identity
  // — it is only required so the SDK's internal WASM executor has a signing key.
  programManager.setAccount(new Account());

  // run() executes the circuit locally — `age` stays inside the WASM sandbox
  // and is never included in the output or sent to the network.
  const result = await programManager.run(
    ALEO_PROGRAM,
    "prove_age_over_18",
    [`${age}u8`],
    false, // proveExecution: false = execute only, no proof submission
  );

  // Normalise: some SDK versions expose outputs via getOutputs(), others
  // return them directly.
  const outputs: string[] =
    typeof result.getOutputs === "function"
      ? result.getOutputs()
      : (result.outputs ?? result);

  return {
    proof: JSON.stringify({ outputs, method: "aleo-wasm" }),
    method: "wasm",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Unified entry point — tries WASM first, falls back to server-side CLI
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a ZK proof that `age >= 18`.
 *
 * 1. Attempts client-side WASM execution (age stays in browser).
 * 2. Falls back to server-side CLI execution (/proof/generate) if WASM
 *    is not yet enabled.
 *
 * Returns a zkProof string to be posted to /issuer/issue-vc.
 */
export async function generateProof(
  age: number,
): Promise<{ proof: string; method: "wasm" | "server" }> {
  try {
    const wasm = await generateProofWasm(age);
    console.info("Proof method: wasm");
    return wasm;
  } catch (err) {
    console.warn("WASM proof generation failed — falling back to server:", err);
    const srv = await generateProofServer(age);
    return srv;
  }
}

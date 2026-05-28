/**
 * Development stub for @provablehq/sdk.
 *
 * Turbopack aliases this file instead of the real WASM package during
 * `next dev`. The real package is ~300 MB after compilation and freezes
 * the machine; the alias avoids bundling it entirely.
 *
 * generateProofWasm() will detect undefined exports and throw, causing
 * generateProof() to fall back to the server-side proof path automatically.
 */
export const ProgramManager = undefined;
export const Account = undefined;
// eslint-disable-next-line import/no-anonymous-default-export
export default { ProgramManager: undefined, Account: undefined };

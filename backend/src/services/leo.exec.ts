import { exec } from "child_process";
import { NodeSSH } from "node-ssh";

// Updated Leo program with `private` age input — age is never exposed on-chain.
const LEO_PROGRAM_SOURCE = `program leo.aleo {

    // age is a PRIVATE input — it is never recorded on-chain.
    // The only public output is the boolean result (true / false).
    fn prove_age_over_18(
        private age: u8
    ) -> bool {
        return age >= 18u8;
    }
}`;

/**
 * Extracts the Aleo transaction ID (format: at1...) from Leo CLI output.
 * Returns null if not found (e.g. local execution fallback or parsing failure).
 */
export const extractTxId = (output: string): string | null => {
  const match = output.match(/\bat1[a-z0-9]+/);
  return match ? match[0] : null;
};

export const executeLeoProof = (age: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    (async () => {
      if (!Number.isInteger(age) || age < 0 || age > 150) {
        return reject(new Error("Invalid age input"));
      }

      const leoPath = process.env.LEO_PATH || "/root/aleo-zpass-demo/leo";
      const remoteHost = process.env.LEO_REMOTE_HOST;

      // `leo run` executes the program locally and prints the return value
      // (e.g. "true" or "false") without submitting a network transaction.
      // This is the correct command for proof verification in a demo context.
      const command = `leo run prove_age_over_18 ${age}u8`;

      if (remoteHost) {
        const ssh = new NodeSSH();
        try {
          const sshConfig: any = {
            host: remoteHost,
            username: process.env.LEO_REMOTE_USER || "root",
          };

          if (process.env.LEO_REMOTE_PRIVATE_KEY) {
            sshConfig.privateKey = process.env.LEO_REMOTE_PRIVATE_KEY;
          } else if (process.env.LEO_REMOTE_PASSWORD) {
            sshConfig.password = process.env.LEO_REMOTE_PASSWORD;
          }

          await ssh.connect(sshConfig);

          // Sync the latest Leo source to the remote so private inputs are enforced.
          const escapedSource = LEO_PROGRAM_SOURCE.replace(/'/g, "'\\''");
          await ssh.execCommand(
            `mkdir -p ${leoPath}/src && printf '%s' '${escapedSource}' > ${leoPath}/src/main.leo`,
          );

          const remoteCommand = command;

          const result = await ssh.execCommand(remoteCommand, {
            cwd: leoPath,
          });

          // `leo run` prints compilation warnings to stderr; only treat it
          // as a fatal error when stdout is also empty (genuine failure).
          if (result.stderr && result.stderr.length > 0 && !result.stdout) {
            return reject(new Error(result.stderr));
          }

          return resolve(result.stdout || result.stderr);
        } catch (err) {
          return reject(err as Error);
        } finally {
          try {
            ssh.dispose();
          } catch {}
        }
      }

      // Local execution with a 60s timeout
      exec(
        command,
        { cwd: leoPath, env: { ...process.env }, timeout: 60_000 },
        (error, stdout, stderr) => {
          if (error) return reject(new Error(stderr || error.message));
          resolve(stdout);
        },
      );
    })().catch((err) => reject(err));
  });
};

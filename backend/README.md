# Aleo zPass Backend

Quick notes to run the backend and use remote Leo execution.

Prerequisites

- Node 18+ and npm
- PostgreSQL (for `DATABASE_URL`) or any configured datasource
- If using remote Leo, a reachable host with `leo` installed (example: 192.168.0.14)

Install

```powershell
cd backend
npm install
```

Environment

- Copy `.env.example` to `.env` and fill values.
- Recommended: use a private key for SSH (`LEO_REMOTE_PRIVATE_KEY`) instead of a password.
- Do NOT commit `.env` or secrets to git.

Example (PowerShell) — replace placeholder values:

```powershell
$env:LEO_REMOTE_HOST = "192.168.0.14"
$env:LEO_REMOTE_USER = "root"
# Set password only in your local environment; do NOT commit it to git.
$env:LEO_REMOTE_PASSWORD = "<replace_with_password>"
$env:DATABASE_URL = "postgresql://user:password@localhost:5432/dbname"
npm run dev
```

If you prefer not to store a password in the environment, use a private key and set `LEO_REMOTE_PRIVATE_KEY` instead. Key-based auth is strongly recommended.

Local test (generate proof)

Once the server is running, you can test the proof generation endpoint:

```bash
curl -X POST http://localhost:4000/proof/generate \
  -H "Content-Type: application/json" \
  -d '{"age":25}'
```

Security notes

- Avoid using root/login passwords on shared machines. Prefer key-based SSH.
- If you must use a password, consider scoping access and rotating it after testing.
- The backend currently supports `LEO_REMOTE_HOST`, `LEO_REMOTE_USER`, `LEO_REMOTE_PRIVATE_KEY`, and `LEO_REMOTE_PASSWORD` environment variables. Set only what you need.

Next steps

- Run `npm install` then start the server and validate the `/proof/generate` flow.
- If you want, provide the SSH key path (not the password) and I can show how to test a remote run safely.

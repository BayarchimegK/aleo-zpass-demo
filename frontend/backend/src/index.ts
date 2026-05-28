import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

import authRoutes from "./routes/auth";
import issuerRoutes from "./routes/issuer";
import proofRoutes from "./routes/proof";
import verifierRoutes from "./routes/verifier";
import { initIssuerKeys } from "./lib/issuerKeys";

// Load .env with priority: backend/.env, cwd/.env, then fallback to nearby paths
(() => {
  const candidates = [
    path.resolve(process.cwd(), "backend", ".env"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "..", ".env"),
    path.resolve(__dirname, "..", "..", ".env"),
  ];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        dotenv.config({ path: p });
        console.log(`Loaded env from ${p}`);
        return;
      }
    } catch (e) {
      // ignore and try next
    }
  }

  // last resort: load default .env (dotenv will look in cwd)
  dotenv.config();
  console.log("Loaded env from default location");
})();

const app = express();

// Initialise issuer Ed25519 key pair (reads from env or generates ephemeral)
initIssuerKeys();

// Simple timestamped logger (keeps dependency-free)
const logger = {
  info: (...args: any[]) =>
    console.log(new Date().toISOString(), "INFO", ...args),
  warn: (...args: any[]) =>
    console.warn(new Date().toISOString(), "WARN", ...args),
  error: (...args: any[]) =>
    console.error(new Date().toISOString(), "ERROR", ...args),
};

// Request logging middleware (sanitized)
app.use((req, res, next) => {
  const safeBody = { ...req.body };
  // avoid logging common secrets
  if (safeBody && typeof safeBody === "object") {
    if ("PRIVATE_KEY" in safeBody) safeBody.PRIVATE_KEY = "[REDACTED]";
    if ("password" in safeBody) safeBody.password = "[REDACTED]";
    if ("jwt" in safeBody) safeBody.jwt = "[REDACTED]";
  }
  logger.info(`${req.method} ${req.path}`, { body: safeBody });
  next();
});

app.use(cors());
app.use(express.json());

app.get("/", (_, res) => {
  res.send("Aleo zPass Backend Running");
});

app.use("/auth", authRoutes);
app.use("/issuer", issuerRoutes);
app.use("/proof", proofRoutes);
app.use("/verifier", verifierRoutes);

// Centralized error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  // log full error server-side, but return sanitized message to client
  logger.error("Unhandled error:", err && err.stack ? err.stack : err);

  const status = err && err.status ? err.status : 500;
  const message = err && err.message ? err.message : "Internal Server Error";

  res.status(status).json({ success: false, error: message });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  logger.info(`Server running on ${PORT}`);
});

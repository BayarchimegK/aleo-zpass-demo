import type { NextConfig } from "next";
import path from "path";

const allowed = process.env.ALLOWED_DEV_ORIGINS
  ? process.env.ALLOWED_DEV_ORIGINS.split(",").map((s) => s.trim())
  : ["192.168.0.14", "192.168.0.12"];

const nextConfig: NextConfig = {
  reactStrictMode: process.env.NODE_ENV === "production",
  allowedDevOrigins: allowed,
  // Prevent Next.js from trying to SSR the WASM SDK on the server.
  serverExternalPackages: ["@provablehq/sdk"],

  // In development, alias @provablehq/sdk to a lightweight stub so Turbopack
  // never tries to compile the real ~300 MB WASM package. generateProof()
  // will fall back to the server-side proof path automatically.
  // In production (`next build`), the alias is absent and the real SDK is used.
  turbopack:
    process.env.NODE_ENV !== "production"
      ? {
          root: path.resolve(__dirname),
          resolveAlias: {
            "@provablehq/sdk": "./lib/aleoSdkDevStub.ts",
          },
        }
      : { root: path.resolve(__dirname) },
};

export default nextConfig;

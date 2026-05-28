import { Router } from "express";
import { authMiddleware, AuthRequest } from "../middleware/auth";

const router = Router();

interface ContentItem {
  id: string;
  emoji: string;
  title: string;
  description: string;
  tag: string;
  body: string;
}

const ADULT_CONTENT: ContentItem[] = [
  {
    id: "premium",
    emoji: "🎬",
    title: "Premium Content",
    tag: "adult-only",
    description: "Access exclusive adult-only videos, articles, and media.",
    body: "Full library of premium films, documentaries, and exclusive media available to verified adults.",
  },
  {
    id: "marketplace",
    emoji: "🛒",
    title: "Adult Marketplace",
    tag: "adult-only",
    description: "Browse products available only to verified adults.",
    body: "Curated marketplace with age-restricted product categories including alcohol, tobacco accessories, and more.",
  },
  {
    id: "finance",
    emoji: "🏦",
    title: "Financial Services",
    tag: "adult-only",
    description: "Apply for credit, investment products, and more.",
    body: "Access credit cards, investment accounts, personal loans, and other regulated financial products.",
  },
  {
    id: "gaming",
    emoji: "🎰",
    title: "Gaming & Betting",
    tag: "adult-only",
    description: "Access online gaming and betting platforms.",
    body: "Participate in licensed online gaming, sports betting, and casino-style games where permitted.",
  },
];

const MINOR_CONTENT: ContentItem[] = [
  {
    id: "education",
    emoji: "📚",
    title: "Educational Hub",
    tag: "all-ages",
    description: "Curated learning resources across science, arts, and tech.",
    body: "Interactive courses, quizzes, and video lessons covering math, science, history, and coding — all safe for young learners.",
  },
  {
    id: "youth-games",
    emoji: "🎮",
    title: "Youth Games",
    tag: "all-ages",
    description: "Fun and safe games for all ages.",
    body: "A collection of puzzle games, strategy challenges, and creative sandbox games rated suitable for all ages.",
  },
  {
    id: "stories",
    emoji: "📖",
    title: "Story World",
    tag: "all-ages",
    description: "Age-appropriate stories and reading material.",
    body: "A library of adventure stories, myths, and short novels suitable for young readers, curated by educators.",
  },
  {
    id: "art",
    emoji: "🎨",
    title: "Creative Studio",
    tag: "all-ages",
    description: "Draw, animate, and build creative projects.",
    body: "Drag-and-drop animation tools, digital drawing pads, and collaborative project boards for budding young creators.",
  },
];

const AUTH_BACKEND = process.env.AUTH_BACKEND_URL || "http://localhost:4000";

/**
 * Checks the Auth Backend's Revocation Registry for a given credentialId.
 * Returns true if the credential has been revoked (deny access).
 * Throws on network error so the caller can decide to fail-open or fail-closed.
 */
async function isCredentialRevoked(credentialId: number): Promise<boolean> {
  const url = `${AUTH_BACKEND}/auth/check-revocation/${credentialId}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error(
      `Revocation registry returned ${response.status} for credential ${credentialId}`,
    );
  }
  const body = (await response.json()) as { revoked: boolean };
  return body.revoked === true;
}

// GET /content
// Phase 3: verify JWT, then perform a real-time Revocation Registry check
// using the credentialId embedded in the token.  Short-lived JWTs (15 min)
// plus this per-request check close the revocation gap.
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  const { isAdult: jwtIsAdult, credentialId } = req.user ?? {};

  // ── Revocation Registry check ─────────────────────────────────────────
  if (typeof credentialId === "number") {
    try {
      const revoked = await isCredentialRevoked(credentialId);
      if (revoked) {
        return res
          .status(401)
          .json({
            success: false,
            error: "Session terminated — credential has been revoked.",
          });
      }
    } catch {
      // Registry unreachable — fail-closed to protect content
      return res.status(503).json({
        success: false,
        error: "Could not verify credential status. Please try again later.",
      });
    }
  }

  const isAdult: boolean = jwtIsAdult === true;

  return res.json({
    success: true,
    audience: isAdult ? "adult" : "minor",
    items: isAdult ? ADULT_CONTENT : MINOR_CONTENT,
  });
});

export default router;

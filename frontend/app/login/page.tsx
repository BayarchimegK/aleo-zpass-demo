"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getVCByEmail, getHolderDID } from "../../lib/wallet";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [walletVC, setWalletVC] = useState<boolean | null>(null); // null=unchecked, true=found, false=not found
  const router = useRouter();

  const handleLogin = async () => {
    if (!email.trim()) return;

    setLoading(true);
    setSteps([]);
    setError("");

    try {
      // ── SSI Step 0: check the holder's local wallet for a matching VC ─
      const vc = getVCByEmail(email.trim());
      setWalletVC(vc !== null);
      const holderDID = getHolderDID();

      if (vc) {
        setSteps([
          `지갑: 자격 증명 #${vc.credentialId} 발견 — 발급자 서명이 로컬에서 확인됨.`,
        ]);
      } else {
        setSteps(["지갑: 로컬 자격 증명 없음 — 서버 자격 증명이 사용됩니다."]);
      }

      // ── Phase 2, Step 1: request a one-time nonce ────────────────────
      // The nonce is bound to this login attempt and prevents proof-replay
      // attacks — a stolen proof cannot be reused because it would fail
      // the nonce check on the next attempt.
      setSteps(["서버에서 일회성 논스 요청 중…"]);
      const nonceRes = await fetch("http://localhost:4000/auth/nonce");
      if (!nonceRes.ok) {
        const body = await nonceRes.json().catch(() => ({}));
        throw new Error(
          body.error ?? `논스 요청에 실패했습니다 (${nonceRes.status}).`,
        );
      }
      const { nonce } = await nonceRes.json();

      // ── Phase 2, Step 2: look up the Holder's public credential ID ───
      setSteps((prev) => [...prev, "등록부에서 자격 증명 조회 중…"]);
      const cidRes = await fetch(
        `http://localhost:4000/issuer/credential-by-email?email=${encodeURIComponent(email.trim())}`,
      );
      if (!cidRes.ok) {
        const body = await cidRes.json().catch(() => ({}));
        throw new Error(
          body.error ?? "이 이메일에 해당하는 자격 증명이 없습니다.",
        );
      }
      const { isRevoked } = await cidRes.json();
      if (isRevoked) {
        throw new Error("해당 자격 증명은 발급자에 의해 폐기되었습니다.");
      }

      // ── Phase 2, Step 3: ZK proof generation on the Holder's device ──
      // In production this is done locally via Aleo's WASM SDK — the raw
      // age value never leaves the device; only the proof is sent.
      // For this demo the equivalent Leo execution runs server-side.
      setSteps((prev) => [
        ...prev,
        "기기에서 영지식 증명 생성 중… (나이는 비공개 유지)",
      ]);

      // ── Phase 2, Steps 4–6: submit proof for server-side verification ─
      // POST /auth/verify validates the nonce (one-time use), checks the
      // Revocation Registry before running the proof, checks the nullifier
      // (double-spend prevention), then issues a short-lived JWT (15 min)
      // with credentialId + holderDID embedded.
      //
      // SSI path: include commitment + issuer signature so the server can
      // verify without needing to know the raw age.
      const verifyBody: Record<string, unknown> = {
        email: email.trim(),
        nonce,
        holderDID,
      };
      if (vc) {
        verifyBody.commitment = vc.commitment;
        verifyBody.vcSignature = vc.proof.signature;
      }

      const response = await fetch("http://localhost:4000/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(verifyBody),
      });

      if (!response.body) throw new Error("응답 본문이 없습니다");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data:")) continue;

          const json = JSON.parse(line.slice(5).trim());

          if (json.step) {
            setSteps((prev) => [...prev, json.step]);
          }

          if (json.done) {
            if (json.error) {
              setError(json.error);
            } else {
              // JWT is short-lived (15 min); the Content Backend re-checks
              // the Revocation Registry on every request to close the gap.
              localStorage.setItem("token", json.token);
              localStorage.setItem("isAdult", String(json.isAdult));
              router.push("/");
            }
          }
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">로그인</h1>
          <p className="text-gray-500 mt-2">
            자격 증명에 연결된 이메일을 입력하세요. 귀하의 나이는 기기에만
            남아있으며 — 서버에는 영지식 증명만 전송됩니다.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="이메일 주소"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleLogin()}
            disabled={loading}
            className="border border-gray-300 p-3 rounded-lg w-full focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />

          <button
            onClick={handleLogin}
            disabled={loading || !email.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {loading ? "처리 중…" : "ZK 증명으로 로그인"}
          </button>

          {/* Wallet status badge */}
          {walletVC !== null && (
            <div
              className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${
                walletVC
                  ? "bg-green-50 border-green-200 text-green-700"
                  : "bg-yellow-50 border-yellow-200 text-yellow-700"
              }`}
            >
              <span>{walletVC ? "🔐" : "⚠️"}</span>
              <span>
                {walletVC
                  ? "로컬 지갑에서 자격 증명을 찾았습니다 — 발급자 서명이 사용됩니다."
                  : "지갑에 자격 증명이 없습니다. /holder에서 VC를 가져오세요."}
              </span>
            </div>
          )}

          {/* Step-by-step progress log */}
          {steps.length > 0 && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-600"
                >
                  {i === steps.length - 1 && loading ? (
                    <div className="mt-0.5 h-3 w-3 rounded-full border-2 border-blue-500 border-t-transparent animate-spin shrink-0" />
                  ) : (
                    <span className="text-green-500 shrink-0">✓</span>
                  )}
                  <span>{step}</span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3">
              {error}
            </div>
          )}
        </div>

        {/* ZKP explanation for users */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs text-blue-700 space-y-1">
          <p className="font-semibold">작동 원리</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>지갑이 저장된 검증 가능한 자격 증명(VC)을 확인합니다</li>
            <li>서버가 일회성 논스를 발급합니다 (재사용 공격 방지)</li>
            <li>기기가 실제 나이를 공개하지 않고 연령 ≥ 18을 증명합니다</li>
            <li>
              서버가 증명을 검증하고 폐기 등록부 및 널리파이어를 확인합니다
            </li>
            <li>단기간 세션 토큰(15분)이 발급됩니다</li>
          </ol>
        </div>

        <div className="flex justify-between text-sm text-gray-400">
          <p>
            자격 증명이 없나요?{" "}
            <a href="/issuer" className="text-blue-600 underline">
              발급자에게 요청하세요
            </a>
          </p>
          <a href="/holder" className="text-blue-600 underline">
            내 지갑
          </a>
        </div>
      </div>
    </main>
  );
}

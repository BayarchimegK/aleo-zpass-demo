"use client";

import { useState } from "react";
import api from "../../lib/api";

export default function VerifierPage() {
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  /**
   * Phase 3 — The Verifier (Content Backend) re-checks the Revocation
   * Registry every time content is requested.  Here we demonstrate the
   * check directly against the Auth Backend using the credentialId
   * embedded in the JWT, rather than replaying an on-chain tx ID.
   */
  const verifyCredential = async () => {
    setLoading(true);
    setResult("");
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setResult("No active session — please log in first.");
        return;
      }

      // Decode the JWT payload (no signature verification here — that is
      // the Auth Backend's job; we just want to display the credentialId).
      const payload = JSON.parse(atob(token.split(".")[1]));
      const credentialId: number | undefined = payload.credentialId;

      if (!credentialId) {
        setResult(
          "Session token does not contain a credentialId. Please log in again.",
        );
        return;
      }

      // Call the Revocation Registry endpoint on the Auth Backend
      const response = await api.get(`/auth/check-revocation/${credentialId}`);
      const { revoked } = response.data;

      if (revoked) {
        setResult(
          `폐기됨 — 자격 증명 #${credentialId}이(가) 폐기되었습니다. 접근 거부.`,
        );
      } else {
        setResult(
          `유효 — 자격 증명 #${credentialId}이(가) 활성 상태입니다. 접근 허용.`,
        );
      }
    } catch (err: any) {
      setResult(
        err?.response?.data?.error ??
          "Revocation check failed — check the console for details.",
      );
    } finally {
      setLoading(false);
    }
  };

  const isRevoked = result.startsWith("REVOKED");
  const isValid = result.startsWith("VALID");

  return (
    <main className="min-h-screen bg-gray-50 p-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">검증기</h1>
      <p className="text-gray-500 mb-8 max-w-lg">
        검증기(콘텐츠 백엔드)는 단기간 JWT에 포함된 <code>credentialId</code>를
        사용하여 보호된 모든 요청에 대해 실시간 폐기 등록부 확인을 수행합니다 —
        캐시된 온체인 트랜잭션을 사용하지 않습니다.
      </p>

      <button
        onClick={verifyCredential}
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
      >
        {loading ? "등록부 확인 중…" : "폐기 등록부 확인"}
      </button>

      {result && (
        <div
          className={`mt-6 rounded-xl p-5 border ${
            isRevoked
              ? "bg-red-50 border-red-200 text-red-700"
              : isValid
                ? "bg-green-50 border-green-200 text-green-700"
                : "bg-gray-100 border-gray-200 text-gray-700"
          }`}
        >
          <p className="font-semibold text-lg">{result}</p>
        </div>
      )}

      <div className="mt-10 bg-blue-50 border border-blue-100 rounded-xl p-5 max-w-lg text-sm text-blue-700 space-y-2">
        <p className="font-semibold">3단계 — 실시간 폐기 흐름</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>홀더가 단기간 JWT(15분)를 검증자에게 제시합니다</li>
          <li>
            검증자가 JWT에서 <code>credentialId</code>를 추출합니다
          </li>
          <li>검증자가 인증 백엔드의 폐기 등록부를 조회합니다</li>
          <li>등록부의 실시간 상태에 따라 접근이 허용되거나 거부됩니다</li>
        </ol>
      </div>
    </main>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import api from "../../lib/api";
import { generateProof } from "../../lib/aleoProver";

interface Credential {
  id: number;
  holderEmail: string;
  country: string;
  issuedAt: string;
  isRevoked: boolean;
  revokedAt: string | null;
  proofExpiresAt: string | null;
}

interface IssuedVC {
  credentialId: number;
  vc: object;
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for HTTP (non-secure) contexts
  const el = document.createElement("textarea");
  el.value = text;
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
  return Promise.resolve();
}

export default function IssuerPage() {
  const [email, setEmail] = useState("");
  const [age, setAge] = useState(25);
  const [country, setCountry] = useState("KR");
  const [holderDID, setHolderDID] = useState("");
  const [issuingVC, setIssuingVC] = useState(false);
  const [proofStep, setProofStep] = useState<string | null>(null);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [lastIssuedVC, setLastIssuedVC] = useState<IssuedVC | null>(null);
  const [vcCopied, setVcCopied] = useState(false);

  const loadCredentials = useCallback(async () => {
    setLoadingList(true);
    try {
      const res = await api.get("/issuer/credentials");
      setCredentials(res.data.credentials);
    } catch {
      // silently ignore
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  // Legacy issuance removed — SSI flow only

  const issueVC = async () => {
    if (!email.trim()) return;
    setIssuingVC(true);
    setLastIssuedVC(null);
    setProofStep(null);
    try {
      // Derive the holderDID the same way the backend would auto-derive it,
      // so the commitment is consistent even when the field is left blank.
      const effectiveHolderDID =
        holderDID.trim() ||
        `did:zpass:holder:${Array.from(new TextEncoder().encode(email.trim()))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
          .slice(0, 32)}`;

      // Compute commitment = SHA-256(age:holderDID) entirely client-side.
      // Raw age NEVER leaves the browser — the server only receives this hash.
      // Uses @noble/hashes which works on plain HTTP (no secure context needed).
      const commitment = bytesToHex(
        sha256(new TextEncoder().encode(`${age}:${effectiveHolderDID}`)),
      );

      // ── Step 1: Generate ZK proof ────────────────────────────────────────
      // Tries @provablehq/sdk WASM first (age stays in browser).
      // Falls back to /proof/generate (server runs `leo run` — age sent only
      // to the proof endpoint, never stored, never sent to /issuer/issue-vc).
      setProofStep("연령 ≥ 18의 ZK 증명 생성 중…");
      const { proof: zkProof, method: proofMethod } = await generateProof(age);
      console.info("Proof method used:", proofMethod);

      // ── Step 2: Issue the VC — server derives isAdult from the proof ─────
      // isAdult is NO LONGER a client-supplied boolean; the server parses
      // zkProof and derives it independently.
      setProofStep(`발급자에게 증명 제출 중… (방법: ${proofMethod})`);
      const res = await api.post("/issuer/issue-vc", {
        holderEmail: email.trim(),
        country,
        zkProof,
        holderDID: holderDID.trim() || undefined,
        commitment,
      });

      // Assemble the full VC locally — the server response intentionally
      // omits claims.age; we add it here so the holder's wallet has it.
      const data = res.data;
      const vc = {
        "@context": ["https://www.w3.org/2018/credentials/v1"],
        type: ["VerifiableCredential", "ZPassAgeCredential"],
        credentialId: data.credentialId,
        holderEmail: email.trim(),
        issuerDID: data.issuerDID,
        holderDID: data.holderDID,
        issuedAt: data.issuedAt,
        expiresAt: data.expiresAt,
        claims: { age, country },
        commitment: data.commitment,
        proof: {
          type: "Ed25519Signature2020",
          created: data.issuedAt,
          verificationMethod: `${data.issuerDID}#key-1`,
          signature: data.issuerSignature,
        },
      };

      setLastIssuedVC({ credentialId: data.credentialId, vc });
      setEmail("");
      setProofStep(null);
      await loadCredentials();
    } catch (err: any) {
      setProofStep(null);
      alert(err?.response?.data?.error || "VC 발급에 실패했습니다.");
    } finally {
      setIssuingVC(false);
    }
  };

  const revokeCredential = async (id: number) => {
    if (
      !confirm(
        "이 자격 증명을 폐기하시겠습니까? 홀더는 더 이상 로그인할 수 없습니다.",
      )
    )
      return;
    setRevokingId(id);
    try {
      await api.post(`/issuer/revoke/${id}`);
      await loadCredentials();
    } catch (err: any) {
      alert(err?.response?.data?.error || "자격 증명 폐기에 실패했습니다.");
    } finally {
      setRevokingId(null);
    }
  };

  const deleteCredential = async (id: number) => {
    if (!confirm("이 자격 증명을 영구 삭제하시겠습니까? 취소할 수 없습니다."))
      return;
    setDeletingId(id);
    try {
      await api.delete(`/issuer/credentials/${id}`);
      await loadCredentials();
    } catch (err: any) {
      alert(err?.response?.data?.error || "자격 증명 삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-10">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">발급자 대시보드</h1>

      {/* SSI VC issuance */}
      <section className="bg-white rounded-2xl shadow p-6 max-w-md mb-10 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">
            SSI 검증 가능 자격 증명 발급
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            발급자의 Ed25519 키로 자격 증명에 서명하고, 홀더가 지갑으로 가져올
            수 있는 VC JSON을 반환합니다.
          </p>
        </div>

        <input
          type="email"
          placeholder="홀더 이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border border-gray-300 p-2 w-full rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">나이</label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(Number(e.target.value))}
              className="border border-gray-300 p-2 w-full rounded-lg"
            />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">국가</label>
            <input
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="border border-gray-300 p-2 w-full rounded-lg"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">
            홀더 DID (선택사항 — 비워두면 자동 생성)
          </label>
          <input
            type="text"
            placeholder="did:zpass:holder:…"
            value={holderDID}
            onChange={(e) => setHolderDID(e.target.value)}
            className="border border-gray-300 p-2 w-full rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <button
          onClick={issueVC}
          disabled={issuingVC || !email.trim()}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition-colors"
        >
          {issuingVC
            ? (proofStep ?? "VC 발급 중…")
            : "검증 가능한 자격 증명 발급 (SSI)"}
        </button>

        {issuingVC && proofStep && (
          <p className="text-xs text-purple-600 text-center animate-pulse">
            {proofStep}
          </p>
        )}

        {/* VC download panel */}
        {lastIssuedVC && (
          <div className="border border-purple-200 bg-purple-50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-purple-800">
              ✓ VC #{lastIssuedVC.credentialId} 발급됨 — 발급자 Ed25519 키로
              서명됨
            </p>
            <p className="text-xs text-purple-700">
              이 JSON을 홀더와 공유하세요. 홀더는 이를{" "}
              <a href="/holder" className="underline font-medium">
                /holder
              </a>
              에 붙여넣습니다.
            </p>
            <textarea
              readOnly
              rows={6}
              value={JSON.stringify(lastIssuedVC.vc, null, 2)}
              className="w-full border border-purple-200 rounded-lg p-2 text-[10px] font-mono bg-white resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  copyText(JSON.stringify(lastIssuedVC.vc, null, 2)).then(
                    () => {
                      setVcCopied(true);
                      setTimeout(() => setVcCopied(false), 2000);
                    },
                  );
                }}
                className="text-xs text-purple-700 font-semibold border border-purple-300 rounded-lg px-3 py-1 hover:bg-purple-100"
              >
                {vcCopied ? "복사됨!" : "VC JSON 복사"}
              </button>
              <button
                onClick={() => {
                  const blob = new Blob(
                    [JSON.stringify(lastIssuedVC.vc, null, 2)],
                    {
                      type: "application/json",
                    },
                  );
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `vc-${lastIssuedVC.credentialId}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-xs text-purple-700 font-semibold border border-purple-300 rounded-lg px-3 py-1 hover:bg-purple-100"
              >
                VC 다운로드
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Credentials list */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          발급된 자격 증명
        </h2>

        {loadingList ? (
          <p className="text-gray-400 text-sm">로딩…</p>
        ) : credentials.length === 0 ? (
          <p className="text-gray-400 text-sm">
            아직 발급된 자격 증명이 없습니다.
          </p>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {credentials.map((c) => (
              <div
                key={c.id}
                className={`bg-white rounded-xl shadow p-4 flex items-center justify-between border-l-4 ${c.isRevoked ? "border-red-400 opacity-60" : "border-green-400"}`}
              >
                <div className="space-y-0.5">
                  <p className="font-medium text-gray-800">{c.holderEmail}</p>
                  <p className="text-xs text-gray-500">
                    {c.country} · Issued{" "}
                    {new Date(c.issuedAt).toLocaleDateString()}
                    {c.proofExpiresAt && !c.isRevoked && (
                      <>
                        {" "}
                        · Proof expires{" "}
                        {new Date(c.proofExpiresAt).toLocaleDateString()}
                      </>
                    )}
                  </p>
                  {c.isRevoked && (
                    <span className="text-xs text-red-600 font-medium">
                      폐기됨{" "}
                      {c.revokedAt
                        ? new Date(c.revokedAt).toLocaleDateString()
                        : ""}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  {!c.isRevoked && (
                    <button
                      onClick={() => revokeCredential(c.id)}
                      disabled={revokingId === c.id}
                      className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 font-medium border border-red-200 rounded-lg px-3 py-1 hover:bg-red-50 transition-colors"
                    >
                      {revokingId === c.id ? "폐기 중…" : "폐기"}
                    </button>
                  )}
                  <button
                    onClick={() => deleteCredential(c.id)}
                    disabled={deletingId === c.id}
                    className="text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 font-medium border border-gray-200 rounded-lg px-3 py-1 hover:bg-gray-50 transition-colors"
                  >
                    {deletingId === c.id ? "삭제 중…" : "삭제"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

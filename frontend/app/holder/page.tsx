"use client";

import { useState, useEffect } from "react";
import {
  getOrCreateWallet,
  listVCs,
  importVC,
  deleteVC,
  exportWalletJSON,
  importWalletJSON,
  clearWallet,
  type VerifiableCredential,
} from "../../lib/wallet";

type Tab = "identity" | "credentials" | "backup";

function copyText(text: string): Promise<void> {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(text);
  }
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

export default function HolderPage() {
  const [tab, setTab] = useState<Tab>("identity");
  const [holderDID, setHolderDID] = useState<string>("");
  const [createdAt, setCreatedAt] = useState<string>("");
  const [vcs, setVcs] = useState<VerifiableCredential[]>([]);
  const [importText, setImportText] = useState("");
  const [importMsg, setImportMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [backupImportText, setBackupImportText] = useState("");
  const [backupMsg, setBackupMsg] = useState<{
    ok: boolean;
    text: string;
  } | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const wallet = getOrCreateWallet();
    setHolderDID(wallet.holderDID);
    setCreatedAt(wallet.createdAt);
    setVcs(listVCs());
  }, []);

  function refresh() {
    const w = getOrCreateWallet();
    setHolderDID(w.holderDID);
    setCreatedAt(w.createdAt);
    setVcs(listVCs());
  }

  function handleImportVC() {
    setImportMsg(null);
    try {
      const vc = JSON.parse(importText) as VerifiableCredential;
      if (!vc.credentialId || !vc.holderDID || !vc.proof) {
        setImportMsg({
          ok: false,
          text: "유효하지 않은 VC 형식 — 필수 필드가 누락되었습니다.",
        });
        return;
      }
      importVC(vc);
      setImportText("");
      refresh();
      setImportMsg({
        ok: true,
        text: `자격 증명 #${vc.credentialId}이(가) 성공적으로 가져와졌습니다.`,
      });
    } catch {
      setImportMsg({
        ok: false,
        text: "유효하지 않은 JSON — 전체 VC JSON을 붙여넣으세요.",
      });
    }
  }

  function handleDelete(id: number) {
    if (!confirm(`자격 증명 #${id}을(를) 지갑에서 제거하시겠습니까?`)) return;
    deleteVC(id);
    refresh();
    if (expanded === id) setExpanded(null);
  }

  function handleExport() {
    const json = exportWalletJSON();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "zpass-wallet-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportBackup() {
    const result = importWalletJSON(backupImportText);
    if (result.ok) {
      setBackupMsg({ ok: true, text: "지갑이 성공적으로 복원되었습니다." });
      setBackupImportText("");
      refresh();
    } else {
      setBackupMsg({ ok: false, text: result.error ?? "복원에 실패했습니다." });
    }
  }

  function handleClearWallet() {
    if (
      !confirm(
        "이 작업은 지갑의 모든 자격 증명을 영구적으로 삭제합니다. 계속하시겠습니까?",
      )
    )
      return;
    clearWallet();
    refresh();
  }

  const tabClass = (t: Tab) =>
    `px-5 py-2 rounded-t-lg font-medium text-sm transition-colors ${
      tab === t
        ? "bg-white text-blue-600 border border-b-white border-gray-200"
        : "text-gray-500 hover:text-gray-700"
    }`;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">홀더 지갑</h1>
        <p className="text-gray-500 mb-6 text-sm">
          당신의 자기주권 신원 및 검증 가능한 자격 증명 — 브라우저에만
          저장됩니다.
        </p>

        <div className="flex gap-1 border-b border-gray-200">
          <button
            className={tabClass("identity")}
            onClick={() => setTab("identity")}
          >
            신원
          </button>
          <button
            className={tabClass("credentials")}
            onClick={() => setTab("credentials")}
          >
            자격 증명 {vcs.length > 0 && `(${vcs.length})`}
          </button>
          <button
            className={tabClass("backup")}
            onClick={() => setTab("backup")}
          >
            백업
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-b-2xl rounded-tr-2xl shadow p-6 space-y-6">
          {tab === "identity" && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  분산 ID (DID)
                </p>
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <code className="text-xs text-gray-700 break-all flex-1">
                    {holderDID}
                  </code>
                  <button
                    onClick={() => {
                      copyText(holderDID).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      });
                    }}
                    className="shrink-0 text-xs text-blue-500 hover:text-blue-700 font-medium"
                  >
                    {copied ? "복사됨!" : "복사"}
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-600 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">지갑 생성일</span>
                  <span>
                    {createdAt ? new Date(createdAt).toLocaleString() : "—"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">저장된 자격 증명</span>
                  <span>{vcs.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">DID 방식</span>
                  <span className="font-mono text-xs">did:zpass</span>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
                <strong>자기주권:</strong> 당신의 DID와 자격 증명은 브라우저에만
                저장됩니다. 서버는 원시 나이를 받지 않으며, 오직 영지식 증명만
                전송됩니다.
              </div>
            </div>
          )}

          {tab === "credentials" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="font-semibold text-gray-800">
                  검증 가능한 자격 증명 가져오기
                </h2>
                <p className="text-xs text-gray-500">
                  발급자가 자격 증명을 발급한 후 제공한 VC JSON을 붙여넣으세요.
                </p>
                <textarea
                  rows={5}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder='{"credentialId": 1, "holderDID": "did:zpass:holder:...", ...}'
                  className="w-full border border-gray-300 rounded-lg p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleImportVC}
                  disabled={!importText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                >
                  VC 가져오기
                </button>
                {importMsg && (
                  <p
                    className={`text-sm font-medium ${importMsg.ok ? "text-green-600" : "text-red-600"}`}
                  >
                    {importMsg.ok ? "✓" : "✗"} {importMsg.text}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <h2 className="font-semibold text-gray-800">
                  저장된 자격 증명
                </h2>
                {vcs.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">
                    아직 자격 증명이 없습니다. 발급자에게 VC 발급을 요청한 후
                    위에 붙여넣으세요.
                  </p>
                ) : (
                  vcs.map((vc) => (
                    <div
                      key={vc.credentialId}
                      className="border border-gray-200 rounded-xl overflow-hidden"
                    >
                      <div
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50"
                        onClick={() =>
                          setExpanded(
                            expanded === vc.credentialId
                              ? null
                              : vc.credentialId,
                          )
                        }
                      >
                        <div>
                          <p className="font-medium text-gray-800 text-sm">
                            ZPass 연령 자격 증명 #{vc.credentialId}
                          </p>
                          <p className="text-xs text-gray-500">
                            {vc.holderEmail} · Issued{" "}
                            {new Date(vc.issuedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${new Date(vc.expiresAt) > new Date() ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                          >
                            {new Date(vc.expiresAt) > new Date()
                              ? "유효"
                              : "만료됨"}
                          </span>
                          <span className="text-gray-400 text-sm">
                            {expanded === vc.credentialId ? "▲" : "▼"}
                          </span>
                        </div>
                      </div>
                      {expanded === vc.credentialId && (
                        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-gray-400 mb-0.5">국가</p>
                              <p className="font-mono text-gray-700">
                                {vc.claims.country}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 mb-0.5">나이</p>
                              <p className="font-mono text-gray-700">
                                {vc.claims.age}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-gray-400 mb-0.5">발급자 DID</p>
                              <p className="font-mono text-gray-700 break-all text-[10px]">
                                {vc.issuerDID}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-gray-400 mb-0.5">
                                커밋먼트 (SHA-256)
                              </p>
                              <p className="font-mono text-gray-700 break-all text-[10px]">
                                {vc.commitment}
                              </p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-gray-400 mb-0.5">
                                발급자 서명 (Ed25519)
                              </p>
                              <p className="font-mono text-gray-700 break-all text-[10px]">
                                {vc.proof.signature.slice(0, 56)}…
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-400 mb-0.5">만료</p>
                              <p className="font-mono text-gray-700">
                                {new Date(vc.expiresAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() =>
                                copyText(JSON.stringify(vc, null, 2))
                              }
                              className="text-xs text-blue-500 hover:text-blue-700 font-medium"
                            >
                              VC JSON 복사
                            </button>
                            <span className="text-gray-300">|</span>
                            <button
                              onClick={() => handleDelete(vc.credentialId)}
                              className="text-xs text-red-500 hover:text-red-700 font-medium"
                            >
                              지갑에서 제거
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {tab === "backup" && (
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="font-semibold text-gray-800">지갑 내보내기</h2>
                <p className="text-xs text-gray-500">
                  DID와 모든 자격 증명의 JSON 백업을 다운로드합니다. 안전하게
                  보관하세요.
                </p>
                <button
                  onClick={handleExport}
                  className="bg-gray-800 hover:bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                >
                  지갑 백업 다운로드
                </button>
              </div>
              <div className="space-y-2">
                <h2 className="font-semibold text-gray-800">백업에서 복원</h2>
                <p className="text-xs text-gray-500">
                  이전에 내보낸 지갑 JSON을 붙여넣으세요.{" "}
                  <strong>이 작업은 현재 지갑을 대체합니다.</strong>
                </p>
                <textarea
                  rows={6}
                  value={backupImportText}
                  onChange={(e) => setBackupImportText(e.target.value)}
                  placeholder='{"holderDID": "did:zpass:holder:...", "credentials": [...], ...}'
                  className="w-full border border-gray-300 rounded-lg p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleImportBackup}
                  disabled={!backupImportText.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold px-4 py-2 rounded-lg"
                >
                  지갑 복원
                </button>
                {backupMsg && (
                  <p
                    className={`text-sm font-medium ${backupMsg.ok ? "text-green-600" : "text-red-600"}`}
                  >
                    {backupMsg.ok ? "✓" : "✗"} {backupMsg.text}
                  </p>
                )}
              </div>
              <div className="border-t border-gray-100 pt-4">
                <button
                  onClick={handleClearWallet}
                  className="text-sm text-red-500 hover:text-red-700 font-medium"
                >
                  지갑 초기화 (모든 자격 증명 삭제)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

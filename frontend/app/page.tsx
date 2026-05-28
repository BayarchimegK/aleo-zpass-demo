"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api, { contentApi } from "../lib/api";

interface ContentItem {
  id: string;
  emoji: string;
  title: string;
  description: string;
  tag: string;
  body: string;
}

export default function HomePage() {
  const [isAdult, setIsAdult] = useState<boolean | null>(null);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loadingContent, setLoadingContent] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    setIsAdult(localStorage.getItem("isAdult") === "true");

    // Fetch age-appropriate content from the content backend (token attached automatically)
    contentApi
      .get<{ success: boolean; audience: string; items: ContentItem[] }>(
        "/content",
      )
      .then((res) => setItems(res.data.items))
      .catch(() => {
        // Token expired or invalid → force re-login
        localStorage.removeItem("token");
        localStorage.removeItem("isAdult");
        router.push("/login");
      })
      .finally(() => setLoadingContent(false));
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("isAdult");
    router.push("/login");
  };

  if (isAdult === null || loadingContent) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">로딩…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white border-b px-10 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Aleo zPass 데모</h1>
        <div className="flex items-center gap-4">
          <span
            className={`text-sm font-medium px-3 py-1 rounded-full ${isAdult ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
          >
            {isAdult ? "✓ 성인 (ZK 검증됨)" : "⚠ 미성년자 (ZK 검증됨)"}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-800 underline"
          >
            로그아웃
          </button>
        </div>
      </nav>

      <div className="p-10 max-w-4xl mx-auto space-y-8">
        {/* Session info banner */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between text-sm text-blue-700">
          <span>
            세션 토큰은 <strong>15분</strong> 후 만료됩니다. 콘텐츠 백엔드는
            모든 요청마다 폐기 등록부를 재확인합니다.
          </span>
          <a
            href="/verifier"
            className="underline font-medium whitespace-nowrap ml-4"
          >
            검증기 열기 →
          </a>
        </div>

        {/* Banner */}
        {isAdult ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-green-800 mb-1">
              연령 검증 통과
            </h2>
            <p className="text-green-700 text-sm">
              영지식 증명으로 귀하가 18세 이상임이 확인되었습니다 — 정확한
              나이는 공개되지 않습니다.
            </p>
          </div>
        ) : (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-yellow-800 mb-1">
              접근 제한
            </h2>
            <p className="text-yellow-700 text-sm">
              영지식 증명으로 귀하가 연령 기준(18세 이상)을 충족하지 않음이
              확인되었습니다. 성인 콘텐츠는 숨김 처리됩니다.
            </p>
          </div>
        )}

        {/* Content grid — rendered from backend response */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-2xl shadow p-6 space-y-2"
            >
              <span className="text-3xl">{item.emoji}</span>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-gray-800">
                  {item.title}
                </h3>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    item.tag === "adult-only"
                      ? "bg-red-100 text-red-600"
                      : "bg-blue-100 text-blue-600"
                  }`}
                >
                  {item.tag}
                </span>
              </div>
              <p className="text-gray-500 text-sm">{item.description}</p>
              <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 text-gray-600 text-sm">
                {item.body}
              </div>
            </div>
          ))}
        </div>

        {!isAdult && (
          <div className="bg-gray-100 rounded-2xl p-6 border border-dashed border-gray-300">
            <p className="text-gray-500 text-sm text-center">
              🔒 성인 전용 섹션은 숨겨져 있습니다. 오류라고 생각되면 자격 증명
              발급자에게 문의하세요.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";

import { APP_VERSION } from "@/lib/version";
import { featureForPath } from "@/lib/siteFeatures";

const VERSION = APP_VERSION;

const SEMVER_EXPLANATION = [
  { label: "패치 (1.0.X)", desc: "버그 수정", color: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300" },
  { label: "마이너 (1.X.0)", desc: "새로운 기능 추가", color: "bg-blue-50 text-blue-700" },
  { label: "메이저 (X.0.0)", desc: "대규모 변경", color: "bg-orange-50 text-orange-700" },
];

import { CHANGELOG } from "@/lib/changelog";


const TYPE_BADGE: Record<"major" | "minor" | "patch", string> = {
  major: "bg-orange-100 text-orange-700 border border-orange-200",
  minor: "bg-blue-50 text-blue-700 border border-blue-200",
  patch: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700",
};

const TYPE_LABEL: Record<"major" | "minor" | "patch", string> = {
  major: "메이저",
  minor: "마이너",
  patch: "패치",
};

export default function VersionPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <span className="inline-block bg-maple text-ink text-2xl font-bold px-6 py-2 rounded-full tracking-wide font-pixel">
          v{VERSION}
        </span>
        <h1 className="text-3xl font-bold text-ink font-pixel">버전 정보 / 변경 이력</h1>
        <p className="text-dim text-sm">추억길드 전용 메랜 정보 사이트</p>
      </div>

      {/* Semver explanation */}
      <div className="pixel-panel p-6 space-y-3">
        <h2 className="text-base font-semibold text-ink font-pixel">시맨틱 버전 안내</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          {SEMVER_EXPLANATION.map((s) => (
            <div key={s.label} className={`flex-1 rounded-lg px-4 py-3 ${s.color}`}>
              <p className="font-semibold text-sm">{s.label}</p>
              <p className="text-xs mt-0.5 opacity-80">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Changelog timeline */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-ink font-pixel">변경 이력</h2>

        {CHANGELOG.map((entry) => (
          <div key={entry.version} className="flex gap-4">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className="w-3 h-3 rounded-full bg-maple mt-1.5 shrink-0" />
              <div className="w-px flex-1 bg-edge mt-1" />
            </div>

            {/* Card */}
            <div className="pixel-panel p-5 mb-6 flex-1 space-y-4">
              {/* Version header */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-ink font-pixel">v{entry.version}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_BADGE[entry.type]}`}>
                  {TYPE_LABEL[entry.type]}
                </span>
                <span className="text-xs text-dim ml-auto">{entry.date}</span>
              </div>
              <p className="text-sm font-medium text-maple">{entry.title}</p>

              {/* 바뀐 페이지 바로가기 — 경로만 저장하고 이름·아이콘은 메뉴 정의에서 가져온다 */}
              {entry.pages && entry.pages.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {entry.pages.map((href) => {
                    const feature = featureForPath(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className="inline-flex items-center gap-1 rounded-full border border-edge bg-surface px-2.5 py-1 text-xs text-dim transition-colors hover:border-maple hover:text-maple"
                      >
                        {feature?.icon && <span aria-hidden>{feature.icon}</span>}
                        <span>{feature?.label ?? href}</span>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Feature categories */}
              <div className="space-y-4">
                {entry.features.map((cat) => (
                  <div key={cat.category}>
                    <p className="text-xs font-semibold text-dim uppercase tracking-wider mb-1.5">
                      {cat.category}
                    </p>
                    <ul className="space-y-1">
                      {cat.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-ink">
                          <span className="text-maple mt-0.5 shrink-0">•</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

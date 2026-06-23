"use client";

import { useState } from "react";

interface Tab {
  key: string;
  label: string;
  content: React.ReactNode;
}

interface Props {
  tabs: Tab[];
  defaultTab?: string;
  onTabChange?: (key: string) => void;
}

export default function QuestTabs({ tabs, defaultTab, onTabChange }: Props) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.key || "");

  function handleTabChange(key: string) {
    setActiveTab(key);
    onTabChange?.(key);
  }

  const activeContent = tabs.find((t) => t.key === activeTab)?.content;

  return (
    <div>
      {/* Tab headers */}
      <div className="flex border-b-2 border-edge overflow-x-auto" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            onClick={() => handleTabChange(tab.key)}
            className={`font-pixel px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-maple text-maple"
                : "border-transparent text-dim hover:text-maple hover:border-maple"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4" role="tabpanel" id={`tabpanel-${activeTab}`}>
        {activeContent}
      </div>
    </div>
  );
}

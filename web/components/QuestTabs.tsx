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
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            onClick={() => handleTabChange(tab.key)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-orange-500 text-orange-600 dark:text-orange-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300"
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

import React from 'react';
import type { TabsProps } from '@/types';

export function Tabs({ tabs, activeTab, onTabChange }: TabsProps) {
  return (
    <div>
      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors
                ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6 animate-fade-in" key={activeTab}>
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
}

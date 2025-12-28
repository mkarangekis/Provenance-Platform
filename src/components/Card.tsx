import React from 'react';
import type { CardProps } from '@/types';

export function Card({ children, className = '', title, actions }: CardProps) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {(title || actions) && (
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          {title && <h3 className="text-lg font-semibold text-gray-900">{title}</h3>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="px-6 py-4">{children}</div>
    </div>
  );
}

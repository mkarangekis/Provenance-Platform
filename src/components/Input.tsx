import React from 'react';
import type { InputProps } from '@/types';

export function Input({
  label,
  placeholder,
  value,
  onChange,
  type = 'text',
  error,
  disabled = false,
  required = false,
  rows = 4,
}: InputProps) {
  const baseInputStyles =
    'block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm disabled:bg-gray-100 disabled:cursor-not-allowed';
  const errorStyles = error ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : '';

  const inputElement =
    type === 'textarea' ? (
      <textarea
        className={`${baseInputStyles} ${errorStyles}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        rows={rows}
      />
    ) : (
      <input
        type={type}
        className={`${baseInputStyles} ${errorStyles}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
      />
    );

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      {inputElement}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

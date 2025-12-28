import React from 'react';
import type { BadgeProps } from '@/types';

export function Badge({ children, variant = 'default', size = 'md', className = '' }: BadgeProps & { className?: string }) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full';

  const variantStyles = {
    default: 'bg-gray-100 text-gray-800',
    primary: 'bg-blue-100 text-blue-800',
    success: 'bg-green-100 text-green-800',
    warning: 'bg-yellow-100 text-yellow-800',
    danger: 'bg-red-100 text-red-800',
  };

  const sizeStyles = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  const classes = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  return <span className={classes}>{children}</span>;
}

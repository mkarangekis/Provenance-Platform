/**
 * Type Exports for Provenance Pulse
 * Central export point for all TypeScript types
 */

import type { User } from "@supabase/supabase-js";
import type { Org } from "./database";

// Database types
export * from './database';

// API types
export * from './api';

// UI Component types
export interface NoticeProps {
  kind?: 'info' | 'success' | 'error' | 'warning';
  children: React.ReactNode;
  onDismiss?: () => void;
}

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
}

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
}

export interface InputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'textarea';
  error?: string;
  disabled?: boolean;
  required?: boolean;
  rows?: number;
}

export interface SelectProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  error?: string;
  disabled?: boolean;
  required?: boolean;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface TabsProps {
  tabs: Array<{ id: string; label: string; content: React.ReactNode }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
}

// Form types
export interface FormField<T = unknown> {
  value: T;
  error?: string;
  touched: boolean;
}

export interface FormState<T> {
  fields: { [K in keyof T]: FormField<T[K]> };
  isSubmitting: boolean;
  isValid: boolean;
}

// Table types
export interface TableColumn<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  onRowClick?: (row: T) => void;
  isLoading?: boolean;
  emptyMessage?: string;
}

// Sidebar navigation types
export interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  href: string;
  badge?: string | number;
  children?: NavItem[];
}

export interface AppShellProps {
  children: React.ReactNode;
  navItems?: NavItem[];
  user?: User | null | {
    name?: string;
    email?: string;
    avatar?: string;
  };
  org?: Org | null | {
    name?: string;
  };
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export type Maybe<T> = T | null | undefined;

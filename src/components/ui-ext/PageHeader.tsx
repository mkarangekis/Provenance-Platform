import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

export function PageHeader({
  title,
  subtitle,
  breadcrumbs = [],
  actions,
  primaryAction,
}: PageHeaderProps) {
  return (
    <div className="space-y-4">
      {breadcrumbs.length > 0 && (
        <nav className="text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-2">
            {breadcrumbs.map((crumb, idx) => (
              <li key={`${crumb.label}-${idx}`} className="flex items-center gap-2">
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-foreground">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">{crumb.label}</span>
                )}
                {idx < breadcrumbs.length - 1 && <span>/</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>

        <div className={cn("flex flex-wrap items-center gap-2", actions && "md:justify-end")}>
          {actions}
          {primaryAction && (
            <>
              {primaryAction.href ? (
                <Button asChild>
                  <Link href={primaryAction.href}>{primaryAction.label}</Link>
                </Button>
              ) : (
                <Button onClick={primaryAction.onClick}>{primaryAction.label}</Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

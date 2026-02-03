interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  kicker?: string;
}

export function SectionHeader({ title, subtitle, kicker }: SectionHeaderProps) {
  return (
    <div className="space-y-2">
      {kicker && <p className="text-xs uppercase tracking-[0.3em] text-text-muted">{kicker}</p>}
      <h1 className="text-3xl font-semibold text-white md:text-4xl">{title}</h1>
      {subtitle && <p className="max-w-3xl text-sm text-text-secondary md:text-base">{subtitle}</p>}
    </div>
  );
}

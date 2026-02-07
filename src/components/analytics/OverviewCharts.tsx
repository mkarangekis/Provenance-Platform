"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { GlassCard } from "@/components/registrata/GlassCard";

type TrendPoint = { date: string; value: number };
type StatusMix = { status: string; count: number };

const COLORS = ["#00d4aa", "#0ea5e9", "#f5c542", "#f97316", "#ef4444", "#7c3aed"];

function formatTick(dateISO: string) {
  // dateISO: YYYY-MM-DD
  const parts = dateISO.split("-");
  if (parts.length !== 3) return dateISO;
  return `${parts[1]}/${parts[2]}`;
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border-muted bg-ink-950/95 px-3 py-2 text-xs text-text-secondary shadow-card">
      <div className="text-text-primary font-semibold">{label}</div>
      {payload.map((p, idx) => (
        <div key={`${p.name}-${idx}`} className="mt-1 flex items-center justify-between gap-4">
          <span>{p.name}</span>
          <span className="text-white">{p.value ?? 0}</span>
        </div>
      ))}
    </div>
  );
}

export function OverviewCharts({
  intakeTrend,
  aiTrend,
  statusMix,
  loading,
  error,
}: {
  intakeTrend: TrendPoint[];
  aiTrend: TrendPoint[];
  statusMix: StatusMix[];
  loading?: boolean;
  error?: string;
}) {
  if (loading) {
    return (
      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="h-72 animate-pulse-soft lg:col-span-2">
          <div />
        </GlassCard>
        <GlassCard className="h-72 animate-pulse-soft">
          <div />
        </GlassCard>
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-text-muted">Analytics</div>
          <div className="text-lg font-semibold text-white">Unable to load charts</div>
          <div className="text-sm text-text-secondary">{error}</div>
        </div>
      </GlassCard>
    );
  }

  const statusData = (statusMix || []).map((s) => ({ name: s.status, value: s.count }));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <GlassCard className="lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-text-muted">Overview</div>
            <div className="text-lg font-semibold text-white">Intake + AI throughput</div>
          </div>
          <div className="text-xs text-text-muted">Last 30 days</div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="h-56 rounded-2xl border border-border-muted bg-surface p-3">
            <div className="mb-2 text-xs uppercase tracking-[0.25em] text-text-muted">Intake trend</div>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={intakeTrend}>
                <XAxis dataKey="date" tickFormatter={formatTick} stroke="rgba(255,255,255,0.35)" />
                <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.35)" />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="value" name="Objects" stroke="#00d4aa" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="h-56 rounded-2xl border border-border-muted bg-surface p-3">
            <div className="mb-2 text-xs uppercase tracking-[0.25em] text-text-muted">AI jobs trend</div>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={aiTrend}>
                <XAxis dataKey="date" tickFormatter={formatTick} stroke="rgba(255,255,255,0.35)" />
                <YAxis allowDecimals={false} stroke="rgba(255,255,255,0.35)" />
                <Tooltip content={<ChartTooltip />} />
                <Line type="monotone" dataKey="value" name="AI jobs" stroke="#0ea5e9" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-[0.3em] text-text-muted">Pipeline</div>
          <div className="text-lg font-semibold text-white">Status mix</div>
        </div>
        <div className="mt-5 h-56 rounded-2xl border border-border-muted bg-surface p-3">
          {statusData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-text-muted">No status data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                  {statusData.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-4 h-28 rounded-2xl border border-border-muted bg-surface p-3">
          <div className="mb-2 text-xs uppercase tracking-[0.25em] text-text-muted">Counts</div>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={statusData}>
              <XAxis dataKey="name" hide />
              <YAxis allowDecimals={false} hide />
              <Tooltip content={<ChartTooltip />} />
              <Bar dataKey="value" name="Count" fill="#00d4aa" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
}

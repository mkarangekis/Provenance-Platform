function envTruthy(value: unknown): boolean {
  if (value == null) return false;
  const v = String(value).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export const featureFlags = {
  enterpriseUI: envTruthy(process.env.ENTERPRISE_UI),
  aiTopPanel: envTruthy(process.env.AI_TOP_PANEL),
  graphsOverview: envTruthy(process.env.GRAPHS_OVERVIEW),
  subscriptionGating: envTruthy(process.env.SUBSCRIPTION_GATING),
};

export type PageContext = "overview" | "inventory" | "ordering" | "variance" | "settings";


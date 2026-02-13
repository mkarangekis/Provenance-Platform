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
  registrataPipelineV2: envTruthy(process.env.REGISTRATA_PIPELINE_V2) || envTruthy(process.env.NEXT_PUBLIC_REGISTRATA_PIPELINE_V2),
  registrataResearchAssistant:
    envTruthy(process.env.REGISTRATA_RESEARCH_ASSISTANT) ||
    envTruthy(process.env.NEXT_PUBLIC_REGISTRATA_RESEARCH_ASSISTANT),
};

export type PageContext = "overview" | "inventory" | "ordering" | "variance" | "settings";

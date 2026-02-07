import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  // Feature flags (compile-time injected for client + server).
  // Defaults are "off" when unset to preserve legacy behavior.
  env: {
    ENTERPRISE_UI: process.env.ENTERPRISE_UI,
    AI_TOP_PANEL: process.env.AI_TOP_PANEL,
    GRAPHS_OVERVIEW: process.env.GRAPHS_OVERVIEW,
    SUBSCRIPTION_GATING: process.env.SUBSCRIPTION_GATING,
  },
};

export default nextConfig;

import api from "./axios";

export const healthApi = {
  // GET /health - Liveness check
  healthCheck: () => {
    return api.get<{ status: string }>("/health");
  },

  // GET /health/db - Readiness check (DB)
  dbHealth: () => {
    return api.get<{ status: string; checks: { db: string } }>("/health/db");
  },
};

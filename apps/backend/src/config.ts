const must = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
};

export const config = {
  port: Number(process.env.BACKEND_PORT ?? 4000),
  jwtSecret: must("JWT_SECRET", "dev-jwt-secret-change-me"),
  agentSharedSecret: must("AGENT_SHARED_SECRET", "dev-agent-secret-change-me"),
  allowedHostKeys: (process.env.ALLOWED_HOST_KEYS ?? "").split(",").map((item) => item.trim()).filter(Boolean),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((item) => item.trim()).filter(Boolean),
  dataFile: process.env.DATA_FILE ?? "data/store.json",
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin123",
  defaultUsername: process.env.DEFAULT_USERNAME ?? "user1",
  defaultUserPassword: process.env.DEFAULT_USER_PASSWORD ?? "user123"
};

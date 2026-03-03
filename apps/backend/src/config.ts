const must = (name: string, fallback?: string): string => {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
};

const legacyDataFile = process.env.DATA_FILE ?? "data/store.json";

const inferDatabaseFile = (): string => {
  if (process.env.DATABASE_FILE) {
    return process.env.DATABASE_FILE;
  }
  if (process.env.DATA_FILE) {
    return process.env.DATA_FILE.endsWith(".json")
      ? `${process.env.DATA_FILE.slice(0, Math.max(0, process.env.DATA_FILE.length - 5))}.db`
      : process.env.DATA_FILE;
  }
  return "data/store.db";
};

export const config = {
  port: Number(process.env.BACKEND_PORT ?? 4000),
  jwtSecret: must("JWT_SECRET", "dev-jwt-secret-change-me"),
  allowedHostKeys: (process.env.ALLOWED_HOST_KEYS ?? "").split(",").map((item) => item.trim()).filter(Boolean),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173").split(",").map((item) => item.trim()).filter(Boolean),
  databaseFile: inferDatabaseFile(),
  legacyDataFile,
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin123",
  defaultUsername: process.env.DEFAULT_USERNAME ?? "user1",
  defaultUserPassword: process.env.DEFAULT_USER_PASSWORD ?? "user123"
};

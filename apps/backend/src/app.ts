import cors from "cors";
import express from "express";
import type { AgentHub } from "./ws/agentHub.js";
import { config } from "./config.js";
import { purgeUncreatedVms } from "./data/store.js";
import { createHealthRouter } from "./routes/health.routes.js";
import { createHostsRouter } from "./routes/hosts.routes.js";
import { createSessionsRouter } from "./routes/sessions.routes.js";
import { createSiteConfigRouter } from "./routes/site-config.routes.js";
import { createSystemOptionsRouter } from "./routes/system-options.routes.js";
import { createUsersRouter } from "./routes/users.routes.js";
import { createVmsRouter } from "./routes/vms.routes.js";

const purgeIntervalMs = 30_000;

export const configureApp = (app: express.Express, hub: AgentHub): void => {
  app.use(cors({ origin: config.corsOrigins }));
  app.use(express.json({ limit: "1mb" }));

  void purgeUncreatedVms();

  let lastPurgeAt = Date.now();
  let purgeInFlight: Promise<void> | null = null;

  const schedulePurgeUncreatedVms = (): void => {
    const elapsed = Date.now() - lastPurgeAt;
    if (elapsed < purgeIntervalMs || purgeInFlight) {
      return;
    }
    purgeInFlight = purgeUncreatedVms()
      .then(() => {
        lastPurgeAt = Date.now();
      })
      .finally(() => {
        purgeInFlight = null;
      });
  };

  app.use(createHealthRouter(hub));
  app.use(createSiteConfigRouter());
  app.use(createSessionsRouter());
  app.use(createUsersRouter());
  app.use(createSystemOptionsRouter());
  app.use(createHostsRouter(hub));
  app.use(createVmsRouter({ hub, schedulePurgeUncreatedVms }));
};

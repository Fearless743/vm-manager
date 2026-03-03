import { createServer } from "node:http";
import express from "express";
import { AgentHub } from "./ws/agentHub.js";
import { configureApp } from "./app.js";
import { config } from "./config.js";
import { findHostNodeByKey } from "./data/store.js";

const app = express();
const server = createServer(app);
const hub = new AgentHub(server, async (secret) => {
  const host = await findHostNodeByKey(secret);
  if (!host || !host.enabled) {
    return null;
  }
  return host.hostKey;
});

configureApp(app, hub);

server.listen(config.port, () => {
  console.log(`Backend listening on http://localhost:${config.port}`);
});

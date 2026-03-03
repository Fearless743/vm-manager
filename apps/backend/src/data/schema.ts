import type { Role, VmStatus } from "@vm-manager/shared";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const usersTable = sqliteTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["user", "admin"] }).$type<Role>().notNull()
});

export const vmsTable = sqliteTable("vms", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  ownerUsername: text("owner_username").notNull(),
  hostKey: text("host_key").notNull(),
  systemId: text("system_id").notNull(),
  image: text("image").notNull(),
  diskSizeGb: integer("disk_size_gb"),
  cpuCores: integer("cpu_cores"),
  memoryMb: integer("memory_mb"),
  bandwidthMbps: integer("bandwidth_mbps"),
  containerId: text("container_id"),
  status: text("status", { enum: ["creating", "running", "stopped", "deleted", "error"] }).$type<VmStatus>().notNull(),
  sshPassword: text("ssh_password"),
  sshPort: integer("ssh_port"),
  openPorts: text("open_ports", { mode: "json" }).$type<number[]>().notNull(),
  lastError: text("last_error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const hostsTable = sqliteTable("hosts", {
  hostKey: text("host_key").primaryKey(),
  name: text("name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const siteConfigTable = sqliteTable("site_config", {
  id: integer("id").primaryKey(),
  siteTitle: text("site_title").notNull(),
  loginSubtitle: text("login_subtitle").notNull(),
  sidebarTitle: text("sidebar_title").notNull()
});

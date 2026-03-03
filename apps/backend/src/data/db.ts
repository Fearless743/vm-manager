import { mkdir } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql/node";
import { config } from "../config.js";

const rawDatabaseFile = config.databaseFile;

const databaseUrl = rawDatabaseFile.startsWith("file:")
  ? rawDatabaseFile
  : `file:${isAbsolute(rawDatabaseFile) ? rawDatabaseFile : resolve(process.cwd(), rawDatabaseFile)}`;

const databaseDirectory = rawDatabaseFile.startsWith("file:") ? null : dirname(isAbsolute(rawDatabaseFile) ? rawDatabaseFile : resolve(process.cwd(), rawDatabaseFile));

export const db = drizzle({
  connection: {
    url: databaseUrl
  }
});

let initialized = false;

export const initializeDatabase = async (): Promise<void> => {
  if (initialized) {
    return;
  }

  if (databaseDirectory) {
    await mkdir(databaseDirectory, { recursive: true });
  }

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'user'))
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS vms (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      owner_username TEXT NOT NULL,
      host_key TEXT NOT NULL,
      system_id TEXT NOT NULL,
      image TEXT NOT NULL,
      disk_size_gb INTEGER,
      cpu_cores INTEGER,
      memory_mb INTEGER,
      bandwidth_mbps INTEGER,
      container_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('creating', 'running', 'stopped', 'deleted', 'error')),
      ssh_password TEXT,
      ssh_port INTEGER,
      open_ports TEXT NOT NULL,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS hosts (
      host_key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  await db.run(sql`
    CREATE TABLE IF NOT EXISTS site_config (
      id INTEGER PRIMARY KEY,
      site_title TEXT NOT NULL,
      login_subtitle TEXT NOT NULL,
      sidebar_title TEXT NOT NULL
    )
  `);

  initialized = true;
};

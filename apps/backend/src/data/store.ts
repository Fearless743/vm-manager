import type { DataStore, HostNodeRecord, Role, SiteConfigRecord, UserRecord, VmRecord } from "@vm-manager/shared";
import { randomBytes, randomUUID } from "node:crypto";
import { access, constants as fsConstants, readFile, rename } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import bcrypt from "bcryptjs";
import { and, eq, isNull, or } from "drizzle-orm";
import { config } from "../config.js";
import { db, initializeDatabase } from "./db.js";
import { hostsTable, siteConfigTable, usersTable, vmsTable } from "./schema.js";

let readyPromise: Promise<void> | null = null;

const now = (): string => new Date().toISOString();

const resolveFilePath = (filePath: string): string => (isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath));

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const isUuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const defaultHosts = (): HostNodeRecord[] => {
  const at = now();
  if (config.allowedHostKeys.length > 0) {
    return config.allowedHostKeys.map((hostKey) => ({
      hostKey,
      name: hostKey,
      enabled: true,
      createdAt: at,
      updatedAt: at
    }));
  }
  return [
    {
      hostKey: "host-dev-001",
      name: "Default Host",
      enabled: true,
      createdAt: at,
      updatedAt: at
    }
  ];
};

const defaultUsers = async (): Promise<UserRecord[]> => {
  const adminHash = await bcrypt.hash(config.adminPassword, 10);
  const users: UserRecord[] = [
    {
      id: randomUUID(),
      username: config.adminUsername,
      passwordHash: adminHash,
      role: "admin"
    }
  ];

  if (config.defaultUsername && config.defaultUserPassword) {
    users.push({
      id: randomUUID(),
      username: config.defaultUsername,
      passwordHash: await bcrypt.hash(config.defaultUserPassword, 10),
      role: "user"
    });
  }

  return users;
};

const defaultSiteConfig = (): SiteConfigRecord => ({
  siteTitle: "LXC 管理平台",
  loginSubtitle: "请使用管理员登录。",
  sidebarTitle: "LXC 管理平台"
});

const toVmRecord = (row: typeof vmsTable.$inferSelect): VmRecord => ({
  id: row.id,
  ownerId: row.ownerId,
  ownerUsername: row.ownerUsername,
  hostKey: row.hostKey,
  systemId: row.systemId,
  image: row.image,
  diskSizeGb: row.diskSizeGb ?? undefined,
  cpuCores: row.cpuCores ?? undefined,
  memoryMb: row.memoryMb ?? undefined,
  bandwidthMbps: row.bandwidthMbps ?? undefined,
  containerId: row.containerId ?? undefined,
  status: row.status,
  sshPassword: row.sshPassword ?? undefined,
  sshPort: row.sshPort ?? undefined,
  openPorts: Array.isArray(row.openPorts) ? row.openPorts : [],
  lastError: row.lastError ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

const toVmUpdateShape = (vm: VmRecord): Partial<typeof vmsTable.$inferInsert> => ({
  ownerId: vm.ownerId,
  ownerUsername: vm.ownerUsername,
  hostKey: vm.hostKey,
  systemId: vm.systemId,
  image: vm.image,
  diskSizeGb: vm.diskSizeGb,
  cpuCores: vm.cpuCores,
  memoryMb: vm.memoryMb,
  bandwidthMbps: vm.bandwidthMbps,
  containerId: vm.containerId,
  status: vm.status,
  sshPassword: vm.sshPassword,
  sshPort: vm.sshPort,
  openPorts: vm.openPorts,
  lastError: vm.lastError,
  updatedAt: vm.updatedAt
});

const normalizeRole = (role: unknown): Role => (role === "admin" ? "admin" : "user");

const normalizeVmStatus = (status: unknown): VmRecord["status"] => {
  if (status === "creating" || status === "running" || status === "stopped" || status === "deleted" || status === "error") {
    return status;
  }
  return "error";
};

const normalizeLegacyStore = (input: unknown): DataStore => {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid legacy store.json format");
  }

  const raw = input as Partial<DataStore>;

  const users: UserRecord[] = Array.isArray(raw.users)
    ? raw.users
      .filter((item): item is UserRecord => Boolean(item && typeof item.id === "string" && typeof item.username === "string" && typeof item.passwordHash === "string"))
      .map((item) => ({
        id: item.id,
        username: item.username,
        passwordHash: item.passwordHash,
        role: normalizeRole(item.role)
      }))
    : [];

  const hosts: HostNodeRecord[] = Array.isArray(raw.hosts)
    ? raw.hosts
      .filter((item): item is HostNodeRecord => Boolean(item && typeof item.hostKey === "string" && typeof item.name === "string"))
      .map((item) => ({
        hostKey: item.hostKey,
        name: item.name,
        enabled: Boolean(item.enabled),
        createdAt: typeof item.createdAt === "string" ? item.createdAt : now(),
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now()
      }))
    : [];

  const vms: VmRecord[] = Array.isArray(raw.vms)
    ? raw.vms
      .filter(
        (item): item is VmRecord =>
          Boolean(item && typeof item.id === "string" && typeof item.ownerId === "string" && typeof item.hostKey === "string" && typeof item.systemId === "string" && typeof item.image === "string")
      )
      .map((item) => ({
        id: item.id,
        ownerId: item.ownerId,
        ownerUsername: typeof item.ownerUsername === "string" ? item.ownerUsername : "unassigned",
        hostKey: item.hostKey,
        systemId: item.systemId,
        image: item.image,
        diskSizeGb: typeof item.diskSizeGb === "number" ? item.diskSizeGb : undefined,
        cpuCores: typeof item.cpuCores === "number" ? item.cpuCores : undefined,
        memoryMb: typeof item.memoryMb === "number" ? item.memoryMb : undefined,
        bandwidthMbps: typeof item.bandwidthMbps === "number" ? item.bandwidthMbps : undefined,
        containerId: typeof item.containerId === "string" ? item.containerId : undefined,
        status: normalizeVmStatus(item.status),
        sshPassword: typeof item.sshPassword === "string" ? item.sshPassword : undefined,
        sshPort: typeof item.sshPort === "number" ? item.sshPort : undefined,
        openPorts: Array.isArray(item.openPorts) ? item.openPorts.filter((port): port is number => typeof port === "number") : [],
        lastError: typeof item.lastError === "string" ? item.lastError : undefined,
        createdAt: typeof item.createdAt === "string" ? item.createdAt : now(),
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : now()
      }))
    : [];

  const siteConfig: SiteConfigRecord = {
    siteTitle: typeof raw.siteConfig?.siteTitle === "string" ? raw.siteConfig.siteTitle : defaultSiteConfig().siteTitle,
    loginSubtitle:
      typeof raw.siteConfig?.loginSubtitle === "string" ? raw.siteConfig.loginSubtitle : defaultSiteConfig().loginSubtitle,
    sidebarTitle: typeof raw.siteConfig?.sidebarTitle === "string" ? raw.siteConfig.sidebarTitle : defaultSiteConfig().sidebarTitle
  };

  return { users, vms, hosts, siteConfig };
};

const makeBackupPath = async (filePath: string): Promise<string> => {
  let candidate = `${filePath}.bak`;
  let suffix = 1;
  while (await fileExists(candidate)) {
    candidate = `${filePath}.bak.${suffix}`;
    suffix += 1;
  }
  return candidate;
};

const migrateLegacyStoreJson = async (): Promise<void> => {
  const legacyPath = resolveFilePath(config.legacyDataFile);
  if (!(await fileExists(legacyPath))) {
    return;
  }

  const [users, hosts, vms, siteConfig] = await Promise.all([
    db.select({ id: usersTable.id }).from(usersTable).limit(1),
    db.select({ hostKey: hostsTable.hostKey }).from(hostsTable).limit(1),
    db.select({ id: vmsTable.id }).from(vmsTable).limit(1),
    db.select({ id: siteConfigTable.id }).from(siteConfigTable).limit(1)
  ]);

  const databaseHasData = users.length > 0 || hosts.length > 0 || vms.length > 0 || siteConfig.length > 0;

  if (!databaseHasData) {
    const rawText = await readFile(legacyPath, "utf8");
    const legacy = normalizeLegacyStore(JSON.parse(rawText));

    await db.transaction(async (tx) => {
      if (legacy.users.length > 0) {
        await tx.insert(usersTable).values(
          legacy.users.map((user) => ({
            id: user.id,
            username: user.username,
            passwordHash: user.passwordHash,
            role: user.role
          }))
        );
      }

      if (legacy.hosts.length > 0) {
        await tx.insert(hostsTable).values(legacy.hosts);
      }

      if (legacy.vms.length > 0) {
        await tx.insert(vmsTable).values(
          legacy.vms.map((vm) => ({
            id: vm.id,
            ownerId: vm.ownerId,
            ownerUsername: vm.ownerUsername,
            hostKey: vm.hostKey,
            systemId: vm.systemId,
            image: vm.image,
            diskSizeGb: vm.diskSizeGb,
            cpuCores: vm.cpuCores,
            memoryMb: vm.memoryMb,
            bandwidthMbps: vm.bandwidthMbps,
            containerId: vm.containerId,
            status: vm.status,
            sshPassword: vm.sshPassword,
            sshPort: vm.sshPort,
            openPorts: vm.openPorts,
            lastError: vm.lastError,
            createdAt: vm.createdAt,
            updatedAt: vm.updatedAt
          }))
        );
      }

      await tx.insert(siteConfigTable).values({ id: 1, ...legacy.siteConfig }).onConflictDoNothing();
    });
  }

  const backupPath = await makeBackupPath(legacyPath);
  await rename(legacyPath, backupPath);
};

const seedDefaults = async (): Promise<void> => {
  const users = await db.select().from(usersTable);
  if (users.length === 0) {
    const initialUsers = await defaultUsers();
    await db.insert(usersTable).values(
      initialUsers.map((user) => ({
        id: user.id,
        username: user.username,
        passwordHash: user.passwordHash,
        role: user.role
      }))
    );
  }

  const hosts = await db.select().from(hostsTable);
  if (hosts.length === 0) {
    await db.insert(hostsTable).values(defaultHosts());
  }

  const siteConfig = await db.select().from(siteConfigTable).where(eq(siteConfigTable.id, 1)).limit(1);
  if (siteConfig.length === 0) {
    await db.insert(siteConfigTable).values({ id: 1, ...defaultSiteConfig() });
  }
};

const migrateLegacyUserIds = async (): Promise<void> => {
  const users = await db.select().from(usersTable);
  const needsMigration = users.filter((user) => !isUuid(user.id));
  if (needsMigration.length === 0) {
    return;
  }

  await db.transaction(async (tx) => {
    for (const user of needsMigration) {
      const migratedId = randomUUID();
      await tx.update(usersTable).set({ id: migratedId }).where(eq(usersTable.id, user.id));
      await tx.update(vmsTable).set({ ownerId: migratedId, updatedAt: now() }).where(eq(vmsTable.ownerId, user.id));
    }
  });
};

const ensureReady = async (): Promise<void> => {
  if (readyPromise) {
    return readyPromise;
  }
  readyPromise = (async () => {
    await initializeDatabase();
    await migrateLegacyStoreJson();
    await seedDefaults();
    await migrateLegacyUserIds();
  })();
  return readyPromise;
};

export const loadStore = async (): Promise<DataStore> => {
  await ensureReady();
  const [users, vms, hosts, siteConfigRows] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(vmsTable),
    db.select().from(hostsTable),
    db.select().from(siteConfigTable).where(eq(siteConfigTable.id, 1)).limit(1)
  ]);

  const siteConfig: SiteConfigRecord = siteConfigRows[0]
    ? {
      siteTitle: siteConfigRows[0].siteTitle,
      loginSubtitle: siteConfigRows[0].loginSubtitle,
      sidebarTitle: siteConfigRows[0].sidebarTitle
    }
    : defaultSiteConfig();

  return {
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      passwordHash: user.passwordHash,
      role: user.role
    })),
    vms: vms.map(toVmRecord),
    hosts: hosts.map((host) => ({
      hostKey: host.hostKey,
      name: host.name,
      enabled: host.enabled,
      createdAt: host.createdAt,
      updatedAt: host.updatedAt
    })),
    siteConfig
  };
};

export const persistStore = async (_store: DataStore): Promise<void> => {
  await ensureReady();
};

export const getStore = async (): Promise<DataStore> => loadStore();

export const createVmRecord = async (input: {
  hostKey: string;
  systemId: string;
  image: string;
  diskSizeGb?: number;
  cpuCores?: number;
  memoryMb?: number;
  bandwidthMbps?: number;
}): Promise<VmRecord> => {
  await ensureReady();
  const createdAt = now();
  const vm: VmRecord = {
    id: randomUUID(),
    ownerId: "unassigned",
    ownerUsername: "unassigned",
    hostKey: input.hostKey,
    systemId: input.systemId,
    image: input.image,
    diskSizeGb: input.diskSizeGb,
    cpuCores: input.cpuCores,
    memoryMb: input.memoryMb,
    bandwidthMbps: input.bandwidthMbps,
    status: "creating",
    openPorts: [],
    createdAt,
    updatedAt: createdAt
  };

  await db.insert(vmsTable).values({
    id: vm.id,
    ownerId: vm.ownerId,
    ownerUsername: vm.ownerUsername,
    hostKey: vm.hostKey,
    systemId: vm.systemId,
    image: vm.image,
    diskSizeGb: vm.diskSizeGb,
    cpuCores: vm.cpuCores,
    memoryMb: vm.memoryMb,
    bandwidthMbps: vm.bandwidthMbps,
    status: vm.status,
    openPorts: vm.openPorts,
    createdAt: vm.createdAt,
    updatedAt: vm.updatedAt
  });

  return vm;
};

export const updateVmRecord = async (vmId: string, patch: Partial<VmRecord>): Promise<VmRecord | null> => {
  await ensureReady();
  const current = await findVmById(vmId);
  if (!current) {
    return null;
  }

  const next: VmRecord = {
    ...current,
    ...patch,
    updatedAt: now()
  };

  await db.update(vmsTable).set(toVmUpdateShape(next)).where(eq(vmsTable.id, vmId));
  return next;
};

export const findVmById = async (vmId: string): Promise<VmRecord | undefined> => {
  await ensureReady();
  const rows = await db.select().from(vmsTable).where(eq(vmsTable.id, vmId)).limit(1);
  const vm = rows[0];
  return vm ? toVmRecord(vm) : undefined;
};

export const deleteVmRecord = async (vmId: string): Promise<boolean> => {
  await ensureReady();
  const vm = await findVmById(vmId);
  if (!vm) {
    return false;
  }
  await db.delete(vmsTable).where(eq(vmsTable.id, vmId));
  return true;
};

export const listVmRecords = async (ownerId?: string): Promise<VmRecord[]> => {
  await ensureReady();
  const rows = ownerId
    ? await db.select().from(vmsTable).where(eq(vmsTable.ownerId, ownerId))
    : await db.select().from(vmsTable);
  return rows.map(toVmRecord);
};

export const purgeUncreatedVms = async (): Promise<number> => {
  await ensureReady();
  const removable = await db
    .select({ id: vmsTable.id })
    .from(vmsTable)
    .where(and(or(eq(vmsTable.status, "creating"), eq(vmsTable.status, "error")), isNull(vmsTable.containerId)));

  if (removable.length === 0) {
    return 0;
  }

  await db
    .delete(vmsTable)
    .where(and(or(eq(vmsTable.status, "creating"), eq(vmsTable.status, "error")), isNull(vmsTable.containerId)));

  return removable.length;
};

export const listUsers = async (): Promise<UserRecord[]> => {
  await ensureReady();
  const users = await db.select().from(usersTable);
  return users.map((user) => ({
    id: user.id,
    username: user.username,
    passwordHash: user.passwordHash,
    role: user.role
  }));
};

export const findUserById = async (userId: string): Promise<UserRecord | undefined> => {
  await ensureReady();
  const rows = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const user = rows[0];
  if (!user) {
    return undefined;
  }
  return {
    id: user.id,
    username: user.username,
    passwordHash: user.passwordHash,
    role: user.role
  };
};

export const createUserRecord = async (input: { username: string; password: string; role: Role }): Promise<UserRecord> => {
  await ensureReady();
  const existing = await db.select().from(usersTable).where(eq(usersTable.username, input.username)).limit(1);
  if (existing.length > 0) {
    throw new Error("username already exists");
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user: UserRecord = {
    id: randomUUID(),
    username: input.username,
    passwordHash,
    role: input.role
  };
  await db.insert(usersTable).values(user);
  return user;
};

export const updateUserRecord = async (
  userId: string,
  patch: { password?: string; role?: Role }
): Promise<UserRecord | null> => {
  await ensureReady();
  const user = await findUserById(userId);
  if (!user) {
    return null;
  }

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (typeof patch.password === "string" && patch.password.length > 0) {
    updates.passwordHash = await bcrypt.hash(patch.password, 10);
  }
  if (patch.role) {
    updates.role = patch.role;
  }

  if (Object.keys(updates).length === 0) {
    return user;
  }

  await db.update(usersTable).set(updates).where(eq(usersTable.id, userId));
  const updated = await findUserById(userId);
  return updated ?? null;
};

export const deleteUserRecord = async (userId: string): Promise<boolean> => {
  await ensureReady();
  const user = await findUserById(userId);
  if (!user) {
    return false;
  }

  await db.transaction(async (tx) => {
    await tx.delete(usersTable).where(eq(usersTable.id, userId));
    await tx
      .update(vmsTable)
      .set({ ownerId: "unassigned", ownerUsername: "unassigned", updatedAt: now() })
      .where(eq(vmsTable.ownerId, userId));
  });

  return true;
};

export const listHostNodes = async (): Promise<HostNodeRecord[]> => {
  await ensureReady();
  const hosts = await db.select().from(hostsTable);
  return hosts.map((host) => ({
    hostKey: host.hostKey,
    name: host.name,
    enabled: host.enabled,
    createdAt: host.createdAt,
    updatedAt: host.updatedAt
  }));
};

export const findHostNodeByKey = async (hostKey: string): Promise<HostNodeRecord | undefined> => {
  await ensureReady();
  const rows = await db.select().from(hostsTable).where(eq(hostsTable.hostKey, hostKey)).limit(1);
  const host = rows[0];
  if (!host) {
    return undefined;
  }
  return {
    hostKey: host.hostKey,
    name: host.name,
    enabled: host.enabled,
    createdAt: host.createdAt,
    updatedAt: host.updatedAt
  };
};

const makeHostKey = (): string => `host-${randomBytes(6).toString("hex")}`;

const generateUniqueHostKey = async (excludeHostKey?: string): Promise<string> => {
  let hostKey = makeHostKey();
  while (hostKey === excludeHostKey || (await findHostNodeByKey(hostKey))) {
    hostKey = makeHostKey();
  }
  return hostKey;
};

export const createHostNode = async (input: { name: string }): Promise<HostNodeRecord> => {
  await ensureReady();
  const hostKey = await generateUniqueHostKey();
  const at = now();
  const record: HostNodeRecord = {
    hostKey,
    name: input.name,
    enabled: true,
    createdAt: at,
    updatedAt: at
  };
  await db.insert(hostsTable).values(record);
  return record;
};

export const updateHostNode = async (
  hostKey: string,
  patch: Partial<Pick<HostNodeRecord, "name" | "enabled">>
): Promise<HostNodeRecord | null> => {
  await ensureReady();
  const host = await findHostNodeByKey(hostKey);
  if (!host) {
    return null;
  }

  const next: HostNodeRecord = {
    ...host,
    name: typeof patch.name === "string" ? patch.name : host.name,
    enabled: typeof patch.enabled === "boolean" ? patch.enabled : host.enabled,
    updatedAt: now()
  };

  await db
    .update(hostsTable)
    .set({ name: next.name, enabled: next.enabled, updatedAt: next.updatedAt })
    .where(eq(hostsTable.hostKey, hostKey));

  return next;
};

export const rotateHostNodeSecret = async (hostKey: string): Promise<HostNodeRecord | null> => {
  await ensureReady();
  const host = await findHostNodeByKey(hostKey);
  if (!host) {
    return null;
  }

  const nextKey = await generateUniqueHostKey(hostKey);

  const updatedAt = now();

  await db.transaction(async (tx) => {
    await tx
      .update(hostsTable)
      .set({ hostKey: nextKey, updatedAt })
      .where(eq(hostsTable.hostKey, hostKey));

    await tx
      .update(vmsTable)
      .set({ hostKey: nextKey, updatedAt })
      .where(eq(vmsTable.hostKey, hostKey));
  });

  return {
    hostKey: nextKey,
    name: host.name,
    enabled: host.enabled,
    createdAt: host.createdAt,
    updatedAt
  };
};

export const getSiteConfig = async (): Promise<SiteConfigRecord> => {
  await ensureReady();
  const rows = await db.select().from(siteConfigTable).where(eq(siteConfigTable.id, 1)).limit(1);
  if (rows.length === 0) {
    const defaults = defaultSiteConfig();
    await db.insert(siteConfigTable).values({ id: 1, ...defaults });
    return defaults;
  }
  return {
    siteTitle: rows[0].siteTitle,
    loginSubtitle: rows[0].loginSubtitle,
    sidebarTitle: rows[0].sidebarTitle
  };
};

export const updateSiteConfig = async (
  patch: Partial<SiteConfigRecord>
): Promise<SiteConfigRecord> => {
  await ensureReady();
  const current = await getSiteConfig();
  const next: SiteConfigRecord = {
    siteTitle: typeof patch.siteTitle === "string" ? patch.siteTitle.trim() || current.siteTitle : current.siteTitle,
    loginSubtitle:
      typeof patch.loginSubtitle === "string" ? patch.loginSubtitle.trim() || current.loginSubtitle : current.loginSubtitle,
    sidebarTitle:
      typeof patch.sidebarTitle === "string" ? patch.sidebarTitle.trim() || current.sidebarTitle : current.sidebarTitle
  };

  await db
    .insert(siteConfigTable)
    .values({ id: 1, ...next })
    .onConflictDoUpdate({
      target: siteConfigTable.id,
      set: {
        siteTitle: next.siteTitle,
        loginSubtitle: next.loginSubtitle,
        sidebarTitle: next.sidebarTitle
      }
    });

  return next;
};

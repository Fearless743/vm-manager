import type { DataStore, HostNodeRecord, Role, UserRecord, VmRecord } from "@lxc-manager/shared";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { config } from "./config.js";

let cache: DataStore | null = null;

const now = (): string => new Date().toISOString();

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

const defaultUsers = async () => {
  const adminHash = await bcrypt.hash(config.adminPassword, 10);
  const userHash = await bcrypt.hash(config.defaultUserPassword, 10);
  return [
    {
      id: randomUUID(),
      username: config.adminUsername,
      passwordHash: adminHash,
      role: "admin" as const
    },
    {
      id: randomUUID(),
      username: config.defaultUsername,
      passwordHash: userHash,
      role: "user" as const
    }
  ];
};

export const loadStore = async (): Promise<DataStore> => {
  if (cache) {
    return cache;
  }
  try {
    const raw = await readFile(config.dataFile, "utf8");
    const parsed = JSON.parse(raw) as Partial<DataStore>;
    const normalized: DataStore = {
      users: parsed.users ?? [],
      vms: parsed.vms ?? [],
      hosts: parsed.hosts ?? defaultHosts()
    };

    const idMapping = new Map<string, string>();
    normalized.users = normalized.users.map((user) => {
      if (isUuid(user.id)) {
        return user;
      }
      const migratedId = randomUUID();
      idMapping.set(user.id, migratedId);
      return {
        ...user,
        id: migratedId
      };
    });

    if (idMapping.size > 0) {
      normalized.vms = normalized.vms.map((vm) => {
        const mapped = idMapping.get(vm.ownerId);
        if (!mapped) {
          return vm;
        }
        return {
          ...vm,
          ownerId: mapped
        };
      });
    }

    cache = normalized;
    await persistStore(normalized);
    return cache;
  } catch {
    const users = await defaultUsers();
    const initial: DataStore = { users, vms: [], hosts: defaultHosts() };
    await persistStore(initial);
    cache = initial;
    return initial;
  }
};

export const persistStore = async (store: DataStore): Promise<void> => {
  await mkdir(dirname(config.dataFile), { recursive: true });
  await writeFile(config.dataFile, JSON.stringify(store, null, 2), "utf8");
  cache = store;
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
  const store = await getStore();
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
  store.vms.push(vm);
  await persistStore(store);
  return vm;
};

export const updateVmRecord = async (vmId: string, patch: Partial<VmRecord>): Promise<VmRecord | null> => {
  const store = await getStore();
  const vm = store.vms.find((item) => item.id === vmId);
  if (!vm) {
    return null;
  }
  Object.assign(vm, patch, { updatedAt: now() });
  await persistStore(store);
  return vm;
};

export const findVmById = async (vmId: string): Promise<VmRecord | undefined> => {
  const store = await getStore();
  return store.vms.find((vm) => vm.id === vmId);
};

export const deleteVmRecord = async (vmId: string): Promise<boolean> => {
  const store = await getStore();
  const before = store.vms.length;
  store.vms = store.vms.filter((vm) => vm.id !== vmId);
  if (store.vms.length === before) {
    return false;
  }
  await persistStore(store);
  return true;
};

export const purgeUncreatedVms = async (): Promise<number> => {
  const store = await getStore();
  const before = store.vms.length;
  store.vms = store.vms.filter((vm) => {
    const failedCreate = (vm.status === "creating" || vm.status === "error") && !vm.containerId;
    return !failedCreate;
  });
  const removed = before - store.vms.length;
  if (removed > 0) {
    await persistStore(store);
  }
  return removed;
};

export const listUsers = async (): Promise<UserRecord[]> => {
  const store = await getStore();
  return store.users;
};

export const findUserById = async (userId: string): Promise<UserRecord | undefined> => {
  const store = await getStore();
  return store.users.find((item) => item.id === userId);
};

export const createUserRecord = async (input: { username: string; password: string; role: Role }): Promise<UserRecord> => {
  const store = await getStore();
  const existing = store.users.find((item) => item.username === input.username);
  if (existing) {
    throw new Error("username already exists");
  }
  const passwordHash = await bcrypt.hash(input.password, 10);
  const user: UserRecord = {
    id: randomUUID(),
    username: input.username,
    passwordHash,
    role: input.role
  };
  store.users.push(user);
  await persistStore(store);
  return user;
};

export const updateUserRecord = async (
  userId: string,
  patch: { password?: string; role?: Role }
): Promise<UserRecord | null> => {
  const store = await getStore();
  const user = store.users.find((item) => item.id === userId);
  if (!user) {
    return null;
  }
  if (typeof patch.password === "string" && patch.password.length > 0) {
    user.passwordHash = await bcrypt.hash(patch.password, 10);
  }
  if (patch.role) {
    user.role = patch.role;
  }
  await persistStore(store);
  return user;
};

export const deleteUserRecord = async (userId: string): Promise<boolean> => {
  const store = await getStore();
  const before = store.users.length;
  store.users = store.users.filter((item) => item.id !== userId);
  if (store.users.length === before) {
    return false;
  }
  store.vms.forEach((vm) => {
    if (vm.ownerId === userId) {
      vm.ownerId = "unassigned";
      vm.ownerUsername = "unassigned";
    }
  });
  await persistStore(store);
  return true;
};

export const listHostNodes = async (): Promise<HostNodeRecord[]> => {
  const store = await getStore();
  return store.hosts;
};

export const findHostNodeByKey = async (hostKey: string): Promise<HostNodeRecord | undefined> => {
  const store = await getStore();
  return store.hosts.find((item) => item.hostKey === hostKey);
};

const makeHostKey = (): string => `host-${randomBytes(6).toString("hex")}`;

export const createHostNode = async (input: { name: string }): Promise<HostNodeRecord> => {
  const store = await getStore();
  let hostKey = makeHostKey();
  while (store.hosts.some((item) => item.hostKey === hostKey)) {
    hostKey = makeHostKey();
  }
  const at = now();
  const record: HostNodeRecord = {
    hostKey,
    name: input.name,
    enabled: true,
    createdAt: at,
    updatedAt: at
  };
  store.hosts.push(record);
  await persistStore(store);
  return record;
};

export const updateHostNode = async (
  hostKey: string,
  patch: Partial<Pick<HostNodeRecord, "name" | "enabled">>
): Promise<HostNodeRecord | null> => {
  const store = await getStore();
  const host = store.hosts.find((item) => item.hostKey === hostKey);
  if (!host) {
    return null;
  }
  if (typeof patch.name === "string") {
    host.name = patch.name;
  }
  if (typeof patch.enabled === "boolean") {
    host.enabled = patch.enabled;
  }
  host.updatedAt = now();
  await persistStore(store);
  return host;
};

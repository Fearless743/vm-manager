const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? "").trim();

export const resolveHttpBase = (): string => {
  if (API_BASE) {
    return API_BASE;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:8080";
};

export const resolveWsBase = (): string => {
  const base = resolveHttpBase();
  return base.startsWith("https://") ? base.replace("https://", "wss://") : base.replace("http://", "ws://");
};

const shellQuote = (value: string): string => `'${value.replace(/'/g, `"'"'`)}'`;

export const buildAgentInstallCommand = (hostKey: string): string => {
  const backendWsUrl = `${resolveWsBase()}/agent-ws`;
  return [
    "curl -fsSL https://raw.githubusercontent.com/Fearless743/vm-manager/main/scripts/install-agent.sh | sudo bash -s --",
    "  --version latest",
    `  --backend-ws-url ${shellQuote(backendWsUrl)}`,
    `  --agent-shared-secret ${shellQuote(hostKey)}`,
  ].join(" \\\n");
};

export const parseErrorText = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
};

export interface Msg { role: "system" | "user" | "assistant"; content: string; }

export interface ModelStatus {
  id: string;
  provider: string;
  model: string;
  label: string;
  free: boolean;
  dailyLimit: number;
  usedToday: number;
  remaining: number | null;
  available: boolean;
  reason?: string;
}

export interface UploadMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  kind: "mcp" | "llm";
  models?: string[];
  addedAt: string;
  lastTest?: string;
  lastStatus?: string;
}

export interface Team {
  id: string;
  name: string;
  members: string[];
  strategy: "vote" | "pipeline" | "debate";
  createdAt: string;
}

export interface Build {
  id: string;
  prompt: string;
  stack: string;
  status: "running" | "done" | "error";
  files: string[];
  modelId?: string;
  createdAt: string;
  log: string[];
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: Msg[];
  modelId?: string;
  teamId?: string;
}

export function fmtBytes(n: number) {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}

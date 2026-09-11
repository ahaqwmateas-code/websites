import fs from "node:fs";
import path from "node:path";

export const DATA_DIR = path.join(process.cwd(), "data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads", "files");
export const UPLOAD_TMP = path.join(DATA_DIR, "uploads", "tmp");
export const BUILD_DIR = path.join(DATA_DIR, "builds");

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

ensureDir(DATA_DIR);
ensureDir(UPLOAD_DIR);
ensureDir(UPLOAD_TMP);
ensureDir(BUILD_DIR);

function file(name: string) {
  return path.join(DATA_DIR, name);
}

export function readJson<T>(name: string, fallback: T): T {
  try {
    const p = file(name);
    if (!fs.existsSync(p)) return fallback;
    const raw = fs.readFileSync(p, "utf8");
    if (!raw.trim()) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(name: string, value: unknown) {
  ensureDir(DATA_DIR);
  fs.writeFileSync(file(name), JSON.stringify(value, null, 2), "utf8");
}

export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

export function uid(prefix = "") {
  return (
    prefix +
    Date.now().toString(36) +
    Math.random().toString(36).slice(2, 10)
  );
}

// ---------- Usage (daily quotas) ----------
type UsageMap = Record<string, Record<string, number>>; // date -> modelId -> count

export function getUsage(date: string, modelId: string): number {
  const all = readJson<UsageMap>("usage.json", {});
  return all[date]?.[modelId] ?? 0;
}

export function bumpUsage(date: string, modelId: string): number {
  const all = readJson<UsageMap>("usage.json", {});
  if (!all[date]) all[date] = {};
  all[date][modelId] = (all[date][modelId] ?? 0) + 1;
  writeJson("usage.json", all);
  return all[date][modelId];
}

export function usageFor(date: string): Record<string, number> {
  const all = readJson<UsageMap>("usage.json", {});
  return all[date] ?? {};
}

// ---------- Generic collections ----------
export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMsg[];
  modelId?: string;
  teamId?: string;
}

export function listConversations(): Conversation[] {
  return readJson<Conversation[]>("chats.json", []);
}
export function saveConversations(v: Conversation[]) {
  writeJson("chats.json", v);
}

export interface UploadMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
  storedName: string;
  textPreview?: string;
}

export function listUploads(): UploadMeta[] {
  return readJson<UploadMeta[]>("uploads.json", []);
}
export function saveUploads(v: UploadMeta[]) {
  writeJson("uploads.json", v);
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  kind: "mcp" | "llm";
  apiKey?: string;
  models?: string[];
  addedAt: string;
  lastTest?: string;
  lastStatus?: string;
}

export function listMcp(): McpServer[] {
  return readJson<McpServer[]>("mcp.json", []);
}
export function saveMcp(v: McpServer[]) {
  writeJson("mcp.json", v);
}

export interface Team {
  id: string;
  name: string;
  members: string[];
  strategy: "vote" | "pipeline" | "debate";
  createdAt: string;
}

export function listTeams(): Team[] {
  return readJson<Team[]>("teams.json", []);
}
export function saveTeams(v: Team[]) {
  writeJson("teams.json", v);
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

export function buildPath(id: string) {
  const p = path.join(BUILD_DIR, id);
  ensureDir(p);
  return p;
}

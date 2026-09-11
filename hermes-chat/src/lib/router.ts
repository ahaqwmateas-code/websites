import { ProviderModel, ProviderError, callModel, registryFromEnv } from "./providers";
import { bumpUsage, getUsage, listMcp, todayKey, ChatMsg } from "./store";

export interface ModelStatus extends ProviderModel {
  usedToday: number;
  remaining: number | null; // null = unlimited
  available: boolean;
  reason?: string;
}

function mcpModels(): ProviderModel[] {
  const out: ProviderModel[] = [];
  for (const s of listMcp()) {
    if (s.kind !== "llm") continue;
    for (const m of s.models ?? []) {
      out.push({
        id: `mcp:${s.id}:${m}`,
        provider: "mcp-llm",
        model: m,
        label: `${s.name} · ${m}`,
        free: true,
        dailyLimit: 0,
        needsKey: !!s.apiKey,
        quality: 3,
      });
    }
  }
  return out;
}

export function fullRegistry(): ProviderModel[] {
  return [...registryFromEnv(), ...mcpModels()];
}

export function modelStatuses(): ModelStatus[] {
  const day = todayKey();
  return fullRegistry().map((m) => {
    const used = getUsage(day, m.id);
    const hasKey =
      !m.needsKey ||
      (m.provider === "groq" && !!process.env.GROQ_API_KEY) ||
      (m.provider === "gemini" && !!process.env.GEMINI_API_KEY) ||
      (m.provider === "openrouter" && !!process.env.OPENROUTER_API_KEY) ||
      (m.provider === "together" && !!process.env.TOGETHER_API_KEY) ||
      (m.provider === "hf" && !!process.env.HF_TOKEN) ||
      (m.provider === "custom" && !!process.env.CUSTOM_API_BASE) ||
      m.provider === "ollama" ||
      m.provider === "mcp-llm";
    const exhausted = m.dailyLimit > 0 && used >= m.dailyLimit;
    return {
      ...m,
      usedToday: used,
      remaining: m.dailyLimit > 0 ? Math.max(0, m.dailyLimit - used) : null,
      available: hasKey && !exhausted,
      reason: !hasKey ? "missing key" : exhausted ? "daily limit reached" : undefined,
    };
  });
}

export interface RouteResult {
  text: string;
  modelId: string;
  provider: string;
  tried: string[];
  switched: boolean;
  demo?: boolean;
}

function chain(preferredId?: string): ProviderModel[] {
  const all = fullRegistry();
  const day = todayKey();
  const usable = all.filter((m) => {
    const used = getUsage(day, m.id);
    if (m.dailyLimit > 0 && used >= m.dailyLimit) return false;
    return true;
  });
  // sort: preferred first, then quality desc (free≈paid), ollama last as fallback
  return usable.sort((a, b) => {
    if (preferredId) {
      if (a.id === preferredId) return -1;
      if (b.id === preferredId) return 1;
    }
    const ao = a.provider === "ollama" ? 1 : 0;
    const bo = b.provider === "ollama" ? 1 : 0;
    if (ao !== bo) return ao - bo;
    return b.quality - a.quality;
  });
}

export function mcpEndpointFor(modelId: string): { baseUrl: string; apiKey: string } | null {
  if (!modelId.startsWith("mcp:")) return null;
  const [, sid] = modelId.split(":");
  const s = listMcp().find((x) => x.id === sid);
  if (!s) return null;
  return { baseUrl: s.url.replace(/\/$/, ""), apiKey: s.apiKey ?? "" };
}

/** Route a chat through the fallback chain. Auto-switches on rate-limit/quota/errors. */
export async function routeChat(messages: ChatMsg[], preferredId?: string): Promise<RouteResult> {
  const ordered = chain(preferredId);
  const tried: string[] = [];
  let lastErr: unknown = null;

  for (const pm of ordered) {
    // skip models whose keys are clearly missing (except ollama/custom handled at call)
    if (pm.provider === "groq" && !process.env.GROQ_API_KEY) continue;
    if (pm.provider === "gemini" && !process.env.GEMINI_API_KEY) continue;
    if (pm.provider === "openrouter" && !process.env.OPENROUTER_API_KEY) continue;
    if (pm.provider === "together" && !process.env.TOGETHER_API_KEY) continue;
    if (pm.provider === "hf" && !process.env.HF_TOKEN) continue;
    if (pm.provider === "custom" && !process.env.CUSTOM_API_BASE) continue;
    tried.push(pm.id);
    try {
      const ep = mcpEndpointFor(pm.id);
      const r = await callModel(pm, messages, ep ? { baseUrl: ep.baseUrl, apiKey: ep.apiKey } : {});
      if (!r.text || !r.text.trim()) throw new ProviderError("empty response", 502, true);
      bumpUsage(todayKey(), pm.id);
      return {
        text: r.text,
        modelId: pm.id,
        provider: pm.provider,
        tried,
        switched: tried.length > 1,
      };
    } catch (e) {
      lastErr = e;
      // 4xx non-retryable (bad key/model) → still try next provider, don't stop
      continue;
    }
  }

  // Demo echo fallback so the UI is usable with zero keys (clearly marked).
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
  const demo =
    `⚠️ **Demo mode — no AI provider reachable.**\n\n` +
    `Tried: ${tried.length ? tried.join(", ") : "none (no API keys set)"}.\n` +
    (lastErr instanceof Error ? `Last error: ${lastErr.message}\n\n` : "\n") +
    `To go live (free):\n` +
    `1. Add a key in \`hermes-chat/.env\` (GROQ / GEMINI / OPENROUTER free tiers), or\n` +
    `2. Run local Ollama: \`ollama serve && ollama pull llama3.1\`, or\n` +
    `3. UI → Connections → Add AI (any OpenAI-compatible base URL).\n\n` +
    `You said: “${lastUser.slice(0, 500)}”`;
  return { text: demo, modelId: "demo:echo", provider: "demo", tried, switched: tried.length > 0, demo: true };
}

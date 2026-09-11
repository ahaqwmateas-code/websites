// Provider registry + low-level chat calls. Everything free-tier first.
import type { ChatMsg } from "./store";

export interface ProviderModel {
  id: string; // unique e.g. "groq:llama-3.1-8b-instant"
  provider: string; // groq | gemini | openrouter | together | hf | ollama | custom | mcp-llm
  model: string; // provider-native name
  label: string;
  free: boolean;
  dailyLimit: number; // 0 = unlimited
  needsKey: boolean;
  quality: number; // 1-5, used for "free ≈ paid" boost ordering
}

function num(v: string | undefined, d: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
}

export function registryFromEnv(): ProviderModel[] {
  const out: ProviderModel[] = [];
  const has = (k: string) => !!process.env[k];

  const L = {
    groq: num(process.env.LIMIT_GROQ_PER_DAY, 14000),
    gemini: num(process.env.LIMIT_GEMINI_PER_DAY, 1500),
    openrouter: num(process.env.LIMIT_OPENROUTER_FREE_PER_DAY, 200),
    together: num(process.env.LIMIT_TOGETHER_PER_DAY, 1000),
    hf: num(process.env.LIMIT_HF_PER_DAY, 1000),
  };

  // Priority order = quality first; router skips models without keys/quota.
  if (has("GROQ_API_KEY")) {
    out.push(
      { id: "groq:llama-3.3-70b-versatile", provider: "groq", model: "llama-3.3-70b-versatile", label: "Groq · Llama 3.3 70B", free: true, dailyLimit: L.groq, needsKey: true, quality: 5 },
      { id: "groq:llama-3.1-8b-instant", provider: "groq", model: "llama-3.1-8b-instant", label: "Groq · Llama 3.1 8B ⚡", free: true, dailyLimit: L.groq, needsKey: true, quality: 4 },
      { id: "groq:mixtral-8x7b-32768", provider: "groq", model: "mixtral-8x7b-32768", label: "Groq · Mixtral 8x7B", free: true, dailyLimit: L.groq, needsKey: true, quality: 4 },
    );
  }
  if (has("GEMINI_API_KEY")) {
    out.push(
      { id: "gemini:gemini-2.0-flash", provider: "gemini", model: "gemini-2.0-flash", label: "Gemini · 2.0 Flash", free: true, dailyLimit: L.gemini, needsKey: true, quality: 5 },
      { id: "gemini:gemini-1.5-flash", provider: "gemini", model: "gemini-1.5-flash", label: "Gemini · 1.5 Flash", free: true, dailyLimit: L.gemini, needsKey: true, quality: 4 },
    );
  }
  if (has("OPENROUTER_API_KEY")) {
    const free = [
      "meta-llama/llama-3.1-8b-instruct:free",
      "mistralai/mistral-7b-instruct:free",
      "google/gemma-2-9b-it:free",
      "qwen/qwen-2-7b-instruct:free",
    ];
    for (const m of free) {
      out.push({ id: `openrouter:${m}`, provider: "openrouter", model: m, label: `OpenRouter · ${m.split("/")[1]}` , free: true, dailyLimit: L.openrouter, needsKey: true, quality: 4 });
    }
  }
  if (has("TOGETHER_API_KEY")) {
    out.push(
      { id: "together:meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", provider: "together", model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", label: "Together · Llama 3.1 8B", free: true, dailyLimit: L.together, needsKey: true, quality: 4 },
      { id: "together:mistralai/Mixtral-8x7B-Instruct-v0.1", provider: "together", model: "mistralai/Mixtral-8x7B-Instruct-v0.1", label: "Together · Mixtral 8x7B", free: true, dailyLimit: L.together, needsKey: true, quality: 4 },
    );
  }
  if (has("HF_TOKEN")) {
    out.push(
      { id: "hf:meta-llama/Meta-Llama-3-8B-Instruct", provider: "hf", model: "meta-llama/Meta-Llama-3-8B-Instruct", label: "HF · Llama 3 8B", free: true, dailyLimit: L.hf, needsKey: true, quality: 3 },
      { id: "hf:mistralai/Mistral-7B-Instruct-v0.3", provider: "hf", model: "mistralai/Mistral-7B-Instruct-v0.3", label: "HF · Mistral 7B", free: true, dailyLimit: L.hf, needsKey: true, quality: 3 },
    );
  }
  // Custom OpenAI-compatible (env)
  if (process.env.CUSTOM_API_BASE) {
    const models = (process.env.CUSTOM_MODELS || "custom-model")
      .split(",").map((s) => s.trim()).filter(Boolean);
    for (const m of models) {
      out.push({ id: `custom:${m}`, provider: "custom", model: m, label: `Custom · ${m}`, free: true, dailyLimit: 0, needsKey: !!process.env.CUSTOM_API_KEY, quality: 3 });
    }
  }
  // Ollama local — always listed (free forever, no key). Router probes it.
  const ollamaModels = ["llama3.1", "mistral", "qwen2.5", "codellama", "gemma2"];
  for (const m of ollamaModels) {
    out.push({ id: `ollama:${m}`, provider: "ollama", model: m, label: `Ollama · ${m} (local)`, free: true, dailyLimit: 0, needsKey: false, quality: 3 });
  }
  return out;
}

export interface LlmResult {
  text: string;
  modelId: string;
  provider: string;
  switchedFrom?: string;
  usage?: { prompt?: number; completion?: number };
}

export class ProviderError extends Error {
  status?: number;
  retryable = true;
  constructor(msg: string, status?: number, retryable = true) {
    super(msg);
    this.status = status;
    this.retryable = retryable;
  }
}

function asOpenAiMessages(msgs: ChatMsg[]) {
  return msgs.map((m) => ({ role: m.role, content: m.content }));
}

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 60000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctl.signal,
    });
    const text = await r.text();
    let json: unknown = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
    if (!r.ok) {
      const msg = typeof json === "object" && json !== null && "error" in json
        ? JSON.stringify((json as { error: unknown }).error).slice(0, 500)
        : text.slice(0, 500);
      const retryable = r.status === 429 || r.status >= 500;
      throw new ProviderError(`${r.status} ${msg || r.statusText}`, r.status, retryable);
    }
    return json as Record<string, unknown>;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(e instanceof Error ? e.message : "fetch failed", undefined, true);
  } finally {
    clearTimeout(t);
  }
}

function openAiText(json: Record<string, unknown>): string {
  try {
    const c = json.choices as Array<{ message?: { content?: string }; text?: string }>;
    return c?.[0]?.message?.content ?? c?.[0]?.text ?? "";
  } catch { return ""; }
}

// Quality boost: makes free models behave closer to paid (explicit reasoning + format discipline).
export const QUALITY_BOOST =
  "You are Hermes, a senior staff engineer. Be precise and complete: think step-by-step internally, " +
  "then answer directly with no filler. When writing code, output full working code. " +
  "If unsure, state assumptions briefly and proceed with the best option.";

export async function callModel(
  pm: ProviderModel,
  messages: ChatMsg[],
  opts: { baseUrl?: string; apiKey?: string; timeoutMs?: number } = {}
): Promise<LlmResult> {
  const msgs = [{ role: "system" as const, content: QUALITY_BOOST }, ...messages];
  const timeoutMs = opts.timeoutMs ?? 60000;

  switch (pm.provider) {
    case "groq": {
      const j = await postJson("https://api.groq.com/openai/v1/chat/completions",
        { authorization: `Bearer ${process.env.GROQ_API_KEY}` },
        { model: pm.model, messages: asOpenAiMessages(msgs), temperature: 0.7, max_tokens: 4096 }, timeoutMs);
      return { text: openAiText(j), modelId: pm.id, provider: pm.provider };
    }
    case "openrouter": {
      const j = await postJson("https://openrouter.ai/api/v1/chat/completions",
        { authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, "HTTP-Referer": "https://hermes-chat.local", "X-Title": "Hermes Chat" },
        { model: pm.model, messages: asOpenAiMessages(msgs), temperature: 0.7, max_tokens: 4096 }, timeoutMs);
      return { text: openAiText(j), modelId: pm.id, provider: pm.provider };
    }
    case "together": {
      const j = await postJson("https://api.together.xyz/v1/chat/completions",
        { authorization: `Bearer ${process.env.TOGETHER_API_KEY}` },
        { model: pm.model, messages: asOpenAiMessages(msgs), temperature: 0.7, max_tokens: 4096 }, timeoutMs);
      return { text: openAiText(j), modelId: pm.id, provider: pm.provider };
    }
    case "gemini": {
      const key = process.env.GEMINI_API_KEY!;
      const contents = msgs.filter((m) => m.role !== "system").map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: (m.role === "user" ? "" : "") + m.content }],
      }));
      const sys = msgs.find((m) => m.role === "system")?.content ?? "";
      const j = await postJson(
        `https://generativelanguage.googleapis.com/v1beta/models/${pm.model}:generateContent?key=${key}`,
        {}, { contents, systemInstruction: sys ? { parts: [{ text: sys }] } : undefined, generationConfig: { temperature: 0.7, maxOutputTokens: 4096 } }, timeoutMs);
      const cands = (j.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }>) ?? [];
      const text = cands.map((c) => (c.content?.parts ?? []).map((p) => p.text ?? "").join("")).join("\n");
      return { text, modelId: pm.id, provider: pm.provider };
    }
    case "hf": {
      const j = await postJson(`https://api-inference.huggingface.co/models/${pm.model}`,
        { authorization: `Bearer ${process.env.HF_TOKEN}` },
        { inputs: msgs.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n") + "\nASSISTANT:", parameters: { max_new_tokens: 2048, temperature: 0.7 } }, 90000);
      const arr = j as unknown as Array<{ generated_text?: string }>;
      const text = Array.isArray(arr) ? (arr[0]?.generated_text ?? "") : JSON.stringify(j).slice(0, 8000);
      return { text, modelId: pm.id, provider: pm.provider };
    }
    case "ollama": {
      const base = (process.env.OLLAMA_BASE_URL || "http://localhost:11434").replace(/\/$/, "");
      const j = await postJson(`${base}/api/chat`, {},
        { model: pm.model, messages: asOpenAiMessages(msgs), stream: false, options: { temperature: 0.7 } }, 120000);
      const text = (j.message as { content?: string } | undefined)?.content ?? "";
      return { text, modelId: pm.id, provider: pm.provider };
    }
    case "custom":
    case "mcp-llm": {
      const base = (opts.baseUrl || process.env.CUSTOM_API_BASE || "").replace(/\/$/, "");
      if (!base) throw new ProviderError("custom base URL missing", 400, false);
      const key = opts.apiKey ?? process.env.CUSTOM_API_KEY ?? "";
      const j = await postJson(`${base}/chat/completions`,
        key ? { authorization: `Bearer ${key}` } : {},
        { model: pm.model, messages: asOpenAiMessages(msgs), temperature: 0.7, max_tokens: 4096 }, timeoutMs);
      return { text: openAiText(j), modelId: pm.id, provider: pm.provider };
    }
    default:
      throw new ProviderError(`unknown provider ${pm.provider}`, 400, false);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { listMcp, saveMcp } from "@/lib/store";

// Test a connection (MCP initialize handshake or LLM /models probe)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const all = listMcp();
  const s = all.find((x) => x.id === params.id);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (s.apiKey) headers.authorization = `Bearer ${s.apiKey}`;
  try {
    let res: Response;
    if (s.kind === "llm") {
      res = await fetch(`${s.url}/models`, { headers });
      if (!res.ok) {
        // try chat-completions probe with tiny prompt
        res = await fetch(`${s.url}/chat/completions`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: s.models?.[0] ?? "default",
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 5,
          }),
        });
      }
    } else {
      res = await fetch(s.url, {
        method: "POST",
        headers,
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "hermes", version: "0.1" } } }),
      });
    }
    const text = (await res.text()).slice(0, 2000);
    s.lastTest = new Date().toISOString();
    s.lastStatus = res.ok ? `OK ${res.status}` : `HTTP ${res.status}: ${text.slice(0, 200)}`;
    saveMcp(all);
    return NextResponse.json({ ok: res.ok, status: res.status, body: text.slice(0, 2000) });
  } catch (e) {
    s.lastTest = new Date().toISOString();
    s.lastStatus = `ERR: ${e instanceof Error ? e.message : "failed"}`;
    saveMcp(all);
    return NextResponse.json({ ok: false, error: s.lastStatus }, { status: 502 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const all = listMcp();
  saveMcp(all.filter((x) => x.id !== params.id));
  return NextResponse.json({ ok: true });
}

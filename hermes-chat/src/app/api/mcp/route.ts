import { NextRequest, NextResponse } from "next/server";
import { listMcp, saveMcp, uid, McpServer } from "@/lib/store";

// List connections (MCP servers + added AIs)
export async function GET() {
  return NextResponse.json({ servers: listMcp() });
}

// Add a connection. Body: { name, url, kind: "mcp"|"llm", apiKey?, models?: string[]|string }
export async function POST(req: NextRequest) {
  const b = (await req.json()) as Partial<McpServer> & { models?: string[] | string };
  if (!b.name || !b.url) {
    return NextResponse.json({ error: "name and url required" }, { status: 400 });
  }
  let models: string[] | undefined;
  if (typeof b.models === "string") {
    models = b.models.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (Array.isArray(b.models)) {
    models = b.models.map((s) => String(s).trim()).filter(Boolean);
  }
  const all = listMcp();
  const entry: McpServer = {
    id: uid("mc_"),
    name: b.name.slice(0, 80),
    url: b.url.replace(/\/$/, "").slice(0, 500),
    kind: b.kind === "llm" ? "llm" : "mcp",
    apiKey: b.apiKey?.slice(0, 500) || undefined,
    models,
    addedAt: new Date().toISOString(),
  };
  all.unshift(entry);
  saveMcp(all);
  return NextResponse.json({ ok: true, server: { ...entry, apiKey: entry.apiKey ? "•••" : undefined } });
}
export const dynamic = "force-dynamic";

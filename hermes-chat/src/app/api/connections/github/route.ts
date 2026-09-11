import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/store";

interface GhStore { pat?: string }
const NAME = "connections.json";

// Connect GitHub with a PAT, list repos, or fetch a file (for "build from repo").
export async function GET() {
  const s = readJson<GhStore>(NAME, {});
  return NextResponse.json({ connected: !!s.pat });
}

export async function POST(req: NextRequest) {
  const b = (await req.json()) as {
    action: "connect" | "repos" | "file" | "disconnect";
    pat?: string; owner?: string; repo?: string; path?: string;
  };
  const store = readJson<GhStore>(NAME, {});
  if (b.action === "connect") {
    if (!b.pat) return NextResponse.json({ error: "pat required" }, { status: 400 });
    const r = await fetch("https://api.github.com/user", {
      headers: { authorization: `Bearer ${b.pat}`, accept: "application/vnd.github+json" },
    });
    if (!r.ok) return NextResponse.json({ error: "invalid token" }, { status: 401 });
    const user = (await r.json()) as { login?: string };
    store.pat = b.pat;
    writeJson(NAME, store);
    return NextResponse.json({ ok: true, user: user.login });
  }
  if (b.action === "disconnect") {
    writeJson(NAME, {});
    return NextResponse.json({ ok: true });
  }
  const pat = store.pat || b.pat;
  if (!pat) return NextResponse.json({ error: "not connected" }, { status: 401 });
  const H = { authorization: `Bearer ${pat}`, accept: "application/vnd.github+json" };

  if (b.action === "repos") {
    const r = await fetch("https://api.github.com/user/repos?per_page=50&sort=updated", { headers: H });
    if (!r.ok) return NextResponse.json({ error: `GitHub ${r.status}` }, { status: 502 });
    const repos = (await r.json()) as Array<{ full_name: string; default_branch: string; updated_at: string }>;
    return NextResponse.json({ repos: repos.map((x) => ({ full_name: x.full_name, branch: x.default_branch, updated: x.updated_at })) });
  }
  if (b.action === "file") {
    if (!b.owner || !b.repo || !b.path) {
      return NextResponse.json({ error: "owner, repo, path required" }, { status: 400 });
    }
    const r = await fetch(
      `https://api.github.com/repos/${b.owner}/${b.repo}/contents/${b.path.replace(/^\/+/, "")}`,
      { headers: H }
    );
    if (!r.ok) return NextResponse.json({ error: `GitHub ${r.status}` }, { status: 502 });
    const j = (await r.json()) as { content?: string; encoding?: string; size?: number; type?: string };
    if (j.type === "dir" || !j.content) return NextResponse.json({ error: "not a file" }, { status: 400 });
    const content = Buffer.from(j.content.replace(/\n/g, ""), "base64").toString("utf8").slice(0, 60000);
    return NextResponse.json({ content, size: j.size });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { buildPath, Build } from "@/lib/store";
import { routeChat } from "@/lib/router";

export const maxDuration = 180;

function readBuild(id: string): Build | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(buildPath(id), "meta.json"), "utf8")) as Build;
  } catch { return null; }
}

// Get build detail (+ optional ?file=path to read one file)
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const b = readBuild(params.id);
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });
  const f = req.nextUrl.searchParams.get("file");
  if (f) {
    const safe = f.replace(/\.\./g, "_");
    const fp = path.join(buildPath(params.id), safe);
    if (!fp.startsWith(buildPath(params.id)) || !fs.existsSync(fp)) {
      return NextResponse.json({ error: "file not found" }, { status: 404 });
    }
    return NextResponse.json({ file: f, content: fs.readFileSync(fp, "utf8").slice(0, 200000) });
  }
  return NextResponse.json({ build: b });
}

// Fix/iterate: { instruction } → patch files via model
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const b = readBuild(params.id);
  if (!b) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { instruction } = (await req.json()) as { instruction: string };
  if (!instruction?.trim()) return NextResponse.json({ error: "instruction required" }, { status: 400 });
  const dir = buildPath(params.id);
  const current = b.files.slice(0, 20).map((f) => {
    try {
      return `--- ${f} ---\n${fs.readFileSync(path.join(dir, f.replace(/\.\./g, "_")), "utf8").slice(0, 8000)}`;
    } catch { return `--- ${f} --- (unreadable)`; }
  }).join("\n\n");
  b.log.push(`[${new Date().toISOString()}] fix requested: ${instruction.slice(0, 200)}`);
  try {
    const r = await routeChat([
      { role: "system", content: "You are Hermes App Builder. Apply the fix. Output changed/added files ONLY as ```path:<path> blocks with FULL file contents." },
      { role: "user", content: `FIX: ${instruction}\n\nCURRENT FILES:\n${current}` },
    ]);
    const fence = /```(?:path:)?([^\n`]*)\n([\s\S]*?)```/g;
    let m: RegExpExecArray | null; let n = 0;
    const seen = new Set(b.files);
    while ((m = fence.exec(r.text))) {
      const p = (m[1] || "").trim();
      if (!p || /^(json|js|ts|py|html|css|bash|sh|text|markdown)$/i.test(p)) continue;
      const safe = p.replace(/^\/+/, "").replace(/\.\./g, "_").slice(0, 200);
      const fp = path.join(dir, safe);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, m[2]);
      if (!seen.has(p)) { b.files.push(p); seen.add(p); }
      n++;
      if (n >= 20) break;
    }
    b.log.push(`[${new Date().toISOString()}] patched ${n} files (model ${r.modelId})`);
    fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(b, null, 2));
    return NextResponse.json({ ok: true, build: b, patched: n });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fix failed" }, { status: 500 });
  }
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  try {
    fs.rmSync(buildPath(params.id), { recursive: true, force: true });
  } catch { /* gone */ }
  return NextResponse.json({ ok: true });
}

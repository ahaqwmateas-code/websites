import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { buildPath, listUploads, uid, Build } from "@/lib/store";
import { routeChat } from "@/lib/router";

export const maxDuration = 180;

function readBuild(id: string): Build | null {
  try {
    const raw = fs.readFileSync(path.join(buildPath(id), "meta.json"), "utf8");
    return JSON.parse(raw) as Build;
  } catch { return null; }
}
function writeBuild(b: Build) {
  fs.writeFileSync(path.join(buildPath(b.id), "meta.json"), JSON.stringify(b, null, 2));
}

// List builds
export async function GET() {
  const { BUILD_DIR } = await import("@/lib/store");
  let ids: string[] = [];
  try { ids = fs.readdirSync(BUILD_DIR); } catch { ids = []; }
  const builds = ids
    .map((id) => readBuild(id))
    .filter((b): b is Build => !!b)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 50);
  return NextResponse.json({ builds });
}

function extractFiles(text: string): { path: string; content: string }[] {
  // Prefer fenced blocks with path: ```path:src/app.js ... ```
  const out: { path: string; content: string }[] = [];
  const fence = /```(?:path:)?([^\n`]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text))) {
    const p = (m[1] || "").trim();
    const content = m[2];
    if (p && !/^(json|js|ts|py|html|css|bash|sh|text|markdown)$/i.test(p) && content.trim()) {
      out.push({ path: p.replace(/^\/+/, "").slice(0, 200), content });
    }
  }
  // Fallback: JSON manifest { "files": { "path": "content" } }
  if (!out.length) {
    try {
      const jm = text.match(/\{[\s\S]*"files"[\s\S]*\}/);
      if (jm) {
        const j = JSON.parse(jm[0]) as { files?: Record<string, string> };
        if (j.files) {
          for (const [p, c] of Object.entries(j.files)) {
            if (typeof c === "string") out.push({ path: p.replace(/^\/+/, "").slice(0, 200), content: c });
          }
        }
      }
    } catch { /* ignore */ }
  }
  return out.slice(0, 50);
}

// Start a build: { prompt, stack?, fileIds?[] }
export async function POST(req: NextRequest) {
  const { prompt, stack, fileIds } = (await req.json()) as {
    prompt: string; stack?: string; fileIds?: string[];
  };
  if (!prompt?.trim()) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const id = uid("bd_");
  const dir = buildPath(id);
  const build: Build = {
    id,
    prompt: prompt.slice(0, 8000),
    stack: (stack || "web").slice(0, 60),
    status: "running",
    files: [],
    createdAt: new Date().toISOString(),
    log: [`[${new Date().toISOString()}] build started (${stack || "web"})`],
  };
  writeBuild(build);

  try {
    let fileCtx = "";
    if (fileIds?.length) {
      const ups = listUploads().filter((u) => fileIds.includes(u.id));
      fileCtx = ups.map((u) => `--- ${u.name} ---\n${(u.textPreview ?? "").slice(0, 8000)}`).join("\n\n");
    }
    build.log.push(`[${new Date().toISOString()}] asking model…`);
    writeBuild(build);
    const r = await routeChat([
      {
        role: "system",
        content:
          "You are Hermes App Builder. Generate a COMPLETE working app from the user prompt. " +
          "Output each file as a fenced block whose info string is the file path, e.g. ```path:index.html ... ```. " +
          "Include every file needed (entry, styles, logic, README). Keep code complete and runnable — no placeholders. " +
          "Max 20 files. Plain output: short plan first, then the file blocks.",
      },
      { role: "user", content: `STACK: ${stack || "web"}\n\nPROMPT:\n${prompt}\n\n${fileCtx ? "REFERENCE FILES:\n" + fileCtx : ""}` },
    ]);
    build.modelId = r.modelId;
    build.log.push(`[${new Date().toISOString()}] model: ${r.modelId}${r.switched ? " (auto-switched)" : ""}`);
    const files = extractFiles(r.text);
    if (!files.length) {
      // save raw answer so nothing is lost
      fs.writeFileSync(path.join(dir, "ANSWER.md"), r.text);
      build.files = ["ANSWER.md"];
      build.log.push(`[${new Date().toISOString()}] no file blocks parsed — saved raw answer to ANSWER.md`);
    } else {
      for (const f of files) {
        const safe = f.path.replace(/\.\./g, "_");
        const fp = path.join(dir, safe);
        fs.mkdirSync(path.dirname(fp), { recursive: true });
        fs.writeFileSync(fp, f.content);
      }
      build.files = files.map((f) => f.path);
      build.log.push(`[${new Date().toISOString()}] wrote ${files.length} files`);
    }
    build.status = "done";
    writeBuild(build);
    return NextResponse.json({ ok: true, build });
  } catch (e) {
    build.status = "error";
    build.log.push(`[${new Date().toISOString()}] ERROR: ${e instanceof Error ? e.message : "failed"}`);
    writeBuild(build);
    return NextResponse.json({ ok: false, build }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";

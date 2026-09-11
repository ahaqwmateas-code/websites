import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, UPLOAD_TMP, listUploads, saveUploads, uid } from "@/lib/store";

const TEXTY = new Set([
  "text/", "application/json", "application/xml", "application/javascript",
  "application/typescript", "application/x-python", "application/pdf",
]);

function isTexty(type: string, name: string) {
  if (TEXTY.has(type) || type.startsWith("text/")) return true;
  return /\.(txt|md|json|js|ts|tsx|jsx|py|java|go|rs|rb|php|html|css|xml|yml|yaml|csv|sh|sql|pdf)$/i.test(name);
}

// Finish upload: move tmp → files, record metadata (persistent until deleted)
export async function POST(req: NextRequest) {
  const { id, name, size, type } = (await req.json()) as {
    id: string; name: string; size: number; type: string;
  };
  if (!id || !/^up_[a-z0-9]+$/.test(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const tmpPath = path.join(UPLOAD_TMP, id + ".part");
  if (!fs.existsSync(tmpPath)) {
    return NextResponse.json({ error: "upload not found" }, { status: 404 });
  }
  const safe = path.basename(name || "file").slice(0, 180).replace(/[^\w.\-() ]/g, "_");
  const fileId = uid("f_");
  const storedName = `${fileId}__${safe}`;
  fs.renameSync(tmpPath, path.join(UPLOAD_DIR, storedName));
  const stat = fs.statSync(path.join(UPLOAD_DIR, storedName));

  let textPreview: string | undefined;
  if (isTexty(type || "", safe) && stat.size < 2 * 1024 * 1024) {
    try {
      textPreview = fs.readFileSync(path.join(UPLOAD_DIR, storedName), "utf8").slice(0, 12000);
    } catch { /* binary */ }
  }

  const ups = listUploads();
  const meta = {
    id: fileId,
    name: safe,
    size: stat.size,
    type: type || "application/octet-stream",
    createdAt: new Date().toISOString(),
    storedName,
    textPreview,
  };
  ups.unshift(meta);
  saveUploads(ups);
  return NextResponse.json({ ok: true, file: meta });
}

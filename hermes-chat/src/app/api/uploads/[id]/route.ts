import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, listUploads, saveUploads } from "@/lib/store";

// Download one file
export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const u = listUploads().find((x) => x.id === params.id);
  if (!u) return NextResponse.json({ error: "not found" }, { status: 404 });
  const p = path.join(UPLOAD_DIR, u.storedName);
  if (!fs.existsSync(p)) return NextResponse.json({ error: "file missing" }, { status: 404 });
  const buf = fs.readFileSync(p);
  return new NextResponse(buf, {
    headers: {
      "content-type": u.type,
      "content-disposition": `attachment; filename="${encodeURIComponent(u.name)}"`,
    },
  });
}

// Delete ONE file (per-file button)
export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const ups = listUploads();
  const u = ups.find((x) => x.id === params.id);
  if (!u) return NextResponse.json({ error: "not found" }, { status: 404 });
  try { fs.unlinkSync(path.join(UPLOAD_DIR, u.storedName)); } catch { /* gone */ }
  saveUploads(ups.filter((x) => x.id !== params.id));
  return NextResponse.json({ ok: true });
}

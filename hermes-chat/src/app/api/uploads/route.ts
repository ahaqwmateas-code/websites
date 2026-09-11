import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR, listUploads, saveUploads } from "@/lib/store";

// List uploads (persistent until deleted)
export async function GET() {
  return NextResponse.json({ uploads: listUploads() });
}

// Delete ALL uploads (the "delete all" button)
export async function DELETE() {
  const ups = listUploads();
  for (const u of ups) {
    try { fs.unlinkSync(path.join(UPLOAD_DIR, u.storedName)); } catch { /* gone */ }
  }
  saveUploads([]);
  return NextResponse.json({ ok: true, deleted: ups.length });
}
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_TMP, uid } from "@/lib/store";

// Start a chunked upload. Body: { name, size, type }
export async function POST(req: NextRequest) {
  const { name, size, type } = (await req.json()) as { name: string; size: number; type: string };
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const id = uid("up_");
  const tmpPath = path.join(UPLOAD_TMP, id + ".part");
  fs.writeFileSync(tmpPath, Buffer.alloc(0));
  const chunkBytes = Number(process.env.UPLOAD_CHUNK_BYTES || 5 * 1024 * 1024);
  return NextResponse.json({
    id,
    chunkBytes,
    name: path.basename(name).slice(0, 180),
    size: size ?? 0,
    type: type ?? "application/octet-stream",
  });
}

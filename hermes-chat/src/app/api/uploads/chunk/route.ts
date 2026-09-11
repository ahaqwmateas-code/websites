import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_TMP } from "@/lib/store";

// Append one chunk. Query: ?id=up_xxx&offset=0  Body: raw bytes
export async function POST(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || !/^up_[a-z0-9]+$/.test(id)) {
    return NextResponse.json({ error: "bad id" }, { status: 400 });
  }
  const tmpPath = path.join(UPLOAD_TMP, id + ".part");
  if (!fs.existsSync(tmpPath)) {
    return NextResponse.json({ error: "upload not initialized" }, { status: 404 });
  }
  const buf = Buffer.from(await req.arrayBuffer());
  fs.appendFileSync(tmpPath, buf);
  const received = fs.statSync(tmpPath).size;
  return NextResponse.json({ ok: true, received });
}

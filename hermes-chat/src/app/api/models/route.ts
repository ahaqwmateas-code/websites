import { NextResponse } from "next/server";
import { modelStatuses } from "@/lib/router";
import { todayKey, usageFor } from "@/lib/store";

export async function GET() {
  const day = todayKey();
  return NextResponse.json({
    date: day,
    usage: usageFor(day),
    models: modelStatuses(),
  });
}
export const dynamic = "force-dynamic";

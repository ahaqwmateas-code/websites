import { NextRequest, NextResponse } from "next/server";
import { listTeams, saveTeams } from "@/lib/store";

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  saveTeams(listTeams().filter((t) => t.id !== params.id));
  return NextResponse.json({ ok: true });
}

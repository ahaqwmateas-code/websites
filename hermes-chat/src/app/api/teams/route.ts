import { NextRequest, NextResponse } from "next/server";
import { listTeams, saveTeams, uid, Team } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ teams: listTeams() });
}

export async function POST(req: NextRequest) {
  const b = (await req.json()) as { name?: string; members?: string[]; strategy?: Team["strategy"] };
  if (!b.name || !b.members?.length) {
    return NextResponse.json({ error: "name and members[] required" }, { status: 400 });
  }
  const all = listTeams();
  const team: Team = {
    id: uid("tm_"),
    name: b.name.slice(0, 80),
    members: b.members.slice(0, 8),
    strategy: b.strategy === "pipeline" || b.strategy === "debate" ? b.strategy : "vote",
    createdAt: new Date().toISOString(),
  };
  all.unshift(team);
  saveTeams(all);
  return NextResponse.json({ ok: true, team });
}
export const dynamic = "force-dynamic";

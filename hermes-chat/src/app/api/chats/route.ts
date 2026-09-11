import { NextRequest, NextResponse } from "next/server";
import { listConversations, saveConversations, uid, Conversation } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ chats: listConversations() });
}

export async function POST(req: NextRequest) {
  const b = (await req.json()) as Partial<Conversation>;
  const all = listConversations();
  const now = new Date().toISOString();
  if (b.id) {
    const i = all.findIndex((c) => c.id === b.id);
    if (i >= 0) {
      all[i] = { ...all[i], ...b, updatedAt: now } as Conversation;
      saveConversations(all);
      return NextResponse.json({ ok: true, chat: all[i] });
    }
  }
  const chat: Conversation = {
    id: uid("ch_"),
    title: (b.title || "New chat").slice(0, 120),
    createdAt: now,
    updatedAt: now,
    messages: b.messages ?? [],
    modelId: b.modelId,
    teamId: b.teamId,
  };
  all.unshift(chat);
  saveConversations(all.slice(0, 100));
  return NextResponse.json({ ok: true, chat });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    saveConversations(listConversations().filter((c) => c.id !== id));
    return NextResponse.json({ ok: true });
  }
  saveConversations([]);
  return NextResponse.json({ ok: true, cleared: true });
}
export const dynamic = "force-dynamic";

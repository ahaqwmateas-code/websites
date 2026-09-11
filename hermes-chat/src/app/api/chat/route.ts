import { NextRequest, NextResponse } from "next/server";
import { routeChat } from "@/lib/router";
import { callModel, registryFromEnv, ProviderModel } from "@/lib/providers";
import { listTeams, listUploads, todayKey, bumpUsage, ChatMsg, mcpEndpointLookup } from "@/lib/chatctx";

export const maxDuration = 120;

interface ChatBody {
  messages: ChatMsg[];
  modelId?: string;
  teamId?: string;
  fileIds?: string[];
  conversationId?: string;
}

async function withFileContext(messages: ChatMsg[], fileIds?: string[]): Promise<ChatMsg[]> {
  if (!fileIds?.length) return messages;
  const ups = listUploads().filter((u) => fileIds.includes(u.id));
  if (!ups.length) return messages;
  const ctx = ups
    .map((u) => `--- FILE: ${u.name} (${u.size} bytes) ---\n${(u.textPreview ?? "").slice(0, 12000)}`)
    .join("\n\n");
  return [
    { role: "system", content: "Attached files for this conversation:\n" + ctx },
    ...messages,
  ];
}

async function runTeam(teamId: string, messages: ChatMsg[]): Promise<{ text: string; modelId: string; tried: string[] }> {
  const { listTeams } = await import("@/lib/store");
  const { fullRegistry } = await import("@/lib/router");
  const team = listTeams().find((t) => t.id === teamId);
  if (!team || !team.members.length) throw new Error("team not found");
  const reg = fullRegistry();
  const tried: string[] = [];
  const answers: { id: string; text: string }[] = [];

  if (team.strategy === "pipeline") {
    let cur = messages;
    for (const mid of team.members) {
      const pm = reg.find((r) => r.id === mid);
      if (!pm) continue;
      tried.push(mid);
      try {
        const ep = (await import("@/lib/router")).mcpEndpointFor(mid);
        const r = await callModel(pm, [
          ...cur,
          { role: "system", content: `You are stage "${mid}" of a pipeline. Improve and extend the previous answer. If this is the first stage, answer directly.` },
        ], ep ? { baseUrl: ep.baseUrl, apiKey: ep.apiKey } : {});
        bumpUsage(todayKey(), mid);
        answers.push({ id: mid, text: r.text });
        cur = [...messages, { role: "assistant", content: r.text }];
      } catch { /* next stage */ }
    }
    const last = answers[answers.length - 1];
    return { text: last?.text ?? "Team pipeline produced no output.", modelId: `team:${teamId}`, tried };
  }

  // vote + debate: parallel answers then synthesis
  await Promise.all(
    team.members.map(async (mid) => {
      const pm = reg.find((r) => r.id === mid);
      if (!pm) return;
      tried.push(mid);
      try {
        const { mcpEndpointFor } = await import("@/lib/router");
        const ep = mcpEndpointFor(mid);
        const r = await callModel(pm, messages, ep ? { baseUrl: ep.baseUrl, apiKey: ep.apiKey } : {});
        bumpUsage(todayKey(), mid);
        answers.push({ id: mid, text: r.text });
      } catch { /* member failed, others continue */ }
    })
  );
  if (!answers.length) throw new Error("all team members failed");
  if (answers.length === 1) return { text: answers[0].text, modelId: `team:${teamId}`, tried };

  const debateNote =
    team.strategy === "debate"
      ? "These models debated 1 round. Reconcile disagreements, pick the best reasoning, and give ONE final answer."
      : "Multiple models answered. Merge into ONE best final answer (keep code complete, resolve conflicts).";
  const synth = await routeChat([
    ...messages,
    { role: "system", content: debateNote + "\n\n" + answers.map((a) => `### ${a.id}\n${a.text.slice(0, 6000)}`).join("\n\n") },
  ]);
  const combined =
    synth.text +
    "\n\n---\n<details><summary>Team members</summary>\n" +
    answers.map((a) => `\n\n#### ${a.id}\n${a.text.slice(0, 4000)}`).join("\n") +
    "\n</details>";
  return { text: combined, modelId: `team:${teamId}+${synth.modelId}`, tried: [...tried, ...synth.tried] };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatBody;
    if (!body.messages?.length) {
      return NextResponse.json({ error: "messages required" }, { status: 400 });
    }
    const messages = await withFileContext(body.messages, body.fileIds);
    if (body.teamId) {
      try {
        const r = await runTeam(body.teamId, messages);
        return NextResponse.json({ ...r, switched: r.tried.length > 1, teamId: body.teamId });
      } catch (e) {
        // fall back to single-model route if team fails
        const r = await routeChat(messages, body.modelId);
        return NextResponse.json({ ...r, teamFallback: true });
      }
    }
    const r = await routeChat(messages, body.modelId);
    return NextResponse.json(r);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "chat failed" },
      { status: 500 }
    );
  }
}

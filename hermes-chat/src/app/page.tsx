"use client";
import { useCallback, useEffect, useState } from "react";
import ChatPane from "@/components/ChatPane";
import UploadPanel from "@/components/UploadPanel";
import ModelsPanel from "@/components/ModelsPanel";
import TeamsPanel from "@/components/TeamsPanel";
import McpPanel from "@/components/McpPanel";
import BuilderPanel from "@/components/BuilderPanel";
import type { Conversation, McpServer, ModelStatus, Msg, Team, UploadMeta } from "@/lib/types";

type View = "chat" | "builder" | "teams" | "models" | "connections";

export default function Home() {
  const [view, setView] = useState<View>("chat");
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [date, setDate] = useState("");
  const [uploads, setUploads] = useState<UploadMeta[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [servers, setServers] = useState<McpServer[]>([]);
  const [chats, setChats] = useState<Conversation[]>([]);

  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [modelId, setModelId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [attached, setAttached] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastMeta, setLastMeta] = useState<{ modelId?: string; switched?: boolean; demo?: boolean; teamId?: string } | null>(null);
  const [rightOpen, setRightOpen] = useState(true);

  const loadModels = useCallback(async () => {
    try {
      const j = await fetch("/api/models").then((r) => r.json());
      setModels(j.models ?? []); setDate(j.date ?? "");
    } catch { /* offline */ }
  }, []);
  const loadUploads = useCallback(async () => {
    try {
      const j = await fetch("/api/uploads").then((r) => r.json());
      setUploads(j.uploads ?? []);
    } catch { /* offline */ }
  }, []);
  const loadTeams = useCallback(async () => {
    try {
      const j = await fetch("/api/teams").then((r) => r.json());
      setTeams(j.teams ?? []);
    } catch { /* offline */ }
  }, []);
  const loadServers = useCallback(async () => {
    try {
      const j = await fetch("/api/mcp").then((r) => r.json());
      setServers(j.servers ?? []);
    } catch { /* offline */ }
  }, []);
  const loadChats = useCallback(async () => {
    try {
      const j = await fetch("/api/chats").then((r) => r.json());
      setChats(j.chats ?? []);
    } catch { /* offline */ }
  }, []);

  useEffect(() => {
    loadModels(); loadUploads(); loadTeams(); loadServers(); loadChats();
  }, [loadModels, loadUploads, loadTeams, loadServers, loadChats]);

  // prune attached ids when files deleted
  useEffect(() => {
    setAttached((a) => a.filter((id) => uploads.some((u) => u.id === id)));
  }, [uploads]);

  const persist = async (msgs: Msg[], id: string | null, title: string) => {
    try {
      const j = await fetch("/api/chats", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, title, messages: msgs, modelId, teamId }),
      }).then((r) => r.json());
      if (j.chat) {
        setChatId(j.chat.id);
        loadChats();
      }
    } catch { /* non-fatal */ }
  };

  const send = async (text: string) => {
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);
    try {
      const j = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next, modelId: modelId || undefined, teamId: teamId || undefined, fileIds: attached }),
      }).then((r) => r.json());
      const reply: Msg = { role: "assistant", content: j.text ?? j.error ?? "(empty)" };
      const final = [...next, reply];
      setMessages(final);
      setLastMeta({ modelId: j.modelId, switched: j.switched, demo: j.demo, teamId: j.teamId });
      const title = next.find((m) => m.role === "user")?.content.slice(0, 60) || "New chat";
      persist(final, chatId, title);
      loadModels(); // refresh quotas
    } catch (e) {
      setMessages([...next, { role: "assistant", content: `⚠️ Request failed: ${e instanceof Error ? e.message : "network error"}` }]);
    } finally {
      setLoading(false);
    }
  };

  const newChat = () => {
    setChatId(null); setMessages([]); setLastMeta(null); setView("chat");
  };

  const openChat = (c: Conversation) => {
    setChatId(c.id); setMessages(c.messages); setLastMeta(null);
    if (c.modelId) setModelId(c.modelId);
    if (c.teamId) setTeamId(c.teamId);
    setView("chat");
  };

  const delChat = async (id: string) => {
    await fetch(`/api/chats?id=${id}`, { method: "DELETE" });
    if (chatId === id) newChat();
    loadChats();
  };

  const sortedModels = [...models].sort((a, b) => Number(b.available) - Number(a.available));
  const readyCount = models.filter((m) => m.available).length;
  const attachedFiles = uploads.filter((u) => attached.includes(u.id));

  return (
    <div className="app">
      {/* LEFT */}
      <aside className="side">
        <div className="brand">
          <div className="logo">H</div>
          <div><b>Hermes Agent</b><small>free AI · auto-switch · teams</small></div>
        </div>
        <div className="nav">
          {(["chat", "builder", "teams", "models", "connections"] as View[]).map((v) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
              {v === "chat" ? "💬 Chat" : v === "builder" ? "🏗 Builder" : v === "teams" ? "👥 Teams" : v === "models" ? "🧠 Models" : "🔌 Links"}
            </button>
          ))}
        </div>
        {view === "chat" && (
          <>
            <button className="newbtn" onClick={newChat}>+ New chat</button>
            <div className="sec">
              <h4>Conversations</h4>
              {chats.map((c) => (
                <div key={c.id} className={`rowitem${chatId === c.id ? " on" : ""}`} onClick={() => openChat(c)}>
                  <span className="t">{c.title}</span>
                  <button className="x" title="delete" onClick={(e) => { e.stopPropagation(); delChat(c.id); }}>✕</button>
                </div>
              ))}
              {chats.length === 0 && <div className="empty">No chats yet.</div>}
            </div>
          </>
        )}
        {view !== "chat" && (
          <div className="sec">
            <h4>Status</h4>
            <div className="kv"><span>Models ready</span><span>{readyCount}/{models.length}</span></div>
            <div className="kv"><span>Files kept</span><span>{uploads.length}</span></div>
            <div className="kv"><span>Teams</span><span>{teams.length}</span></div>
            <div className="kv"><span>Links</span><span>{servers.length}</span></div>
          </div>
        )}
      </aside>

      {/* MAIN */}
      <div className="main">
        {view === "chat" && (
          <>
            <div className="topbar">
              <select value={modelId} onChange={(e) => setModelId(e.target.value)} title="Preferred model (auto-switches on limit)">
                <option value="">⚡ Auto (best free available)</option>
                {sortedModels.map((m) => (
                  <option key={m.id} value={m.id} disabled={!m.available}>
                    {m.available ? "🟢" : "🔴"} {m.label}{m.dailyLimit > 0 ? ` (${m.remaining} left)` : ""}
                  </option>
                ))}
              </select>
              <select value={teamId} onChange={(e) => setTeamId(e.target.value)} title="Team mode">
                <option value="">👤 Single model</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>👥 {t.name} ({t.strategy})</option>
                ))}
              </select>
              <span className={`pill ${readyCount ? "ok" : "err"}`}>{readyCount} models ready</span>
              {attached.length > 0 && <span className="pill">{attached.length} files attached</span>}
              <div className="spacer" />
              <button className="iconbtn" onClick={() => setRightOpen((o) => !o)}>
                {rightOpen ? "📎 Hide files" : "📎 Files"}
              </button>
            </div>
            <ChatPane
              messages={messages}
              loading={loading}
              lastMeta={lastMeta}
              attached={attachedFiles}
              onRemoveAttach={(id) => setAttached((a) => a.filter((x) => x !== id))}
              onSend={send}
            />
          </>
        )}
        {view === "builder" && <BuilderPanel attachedIds={attached} />}
        {view === "teams" && (
          <TeamsPanel teams={teams} models={models} activeTeam={teamId}
            onSelect={(id) => { setTeamId(id); }} onChanged={loadTeams} />
        )}
        {view === "models" && <ModelsPanel models={models} date={date} onRefresh={loadModels} />}
        {view === "connections" && <McpPanel servers={servers} onChanged={() => { loadServers(); loadModels(); }} />}
      </div>

      {/* RIGHT — files live next to chat AND builder */}
      {(view === "chat" || view === "builder") && rightOpen && (
        <aside className="right">
          <UploadPanel
            uploads={uploads}
            selected={attached}
            onToggle={(id) => setAttached((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))}
            onChanged={loadUploads}
          />
        </aside>
      )}
    </div>
  );
}

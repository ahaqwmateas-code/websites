"use client";
import { useState } from "react";
import type { ModelStatus, Team } from "@/lib/types";

export default function TeamsPanel(props: {
  teams: Team[];
  models: ModelStatus[];
  activeTeam: string;
  onSelect: (id: string) => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [strategy, setStrategy] = useState<Team["strategy"]>("vote");
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setMembers((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id].slice(0, 8)));

  const create = async () => {
    if (!name.trim() || !members.length) return;
    setBusy(true);
    await fetch("/api/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, members, strategy }),
    });
    setName(""); setMembers([]);
    setBusy(false);
    props.onChanged();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete team?")) return;
    await fetch(`/api/teams/${id}`, { method: "DELETE" });
    if (props.activeTeam === id) props.onSelect("");
    props.onChanged();
  };

  const avail = props.models.filter((m) => m.available || m.provider === "ollama");

  return (
    <div className="panel"><div className="panel-inner">
      <div className="card">
        <h3>👥 Model teams — multi-AI problem solving</h3>
        <p><b>Vote</b>: all answer in parallel, best merged · <b>Pipeline</b>: each improves the last ·
        <b> Debate</b>: parallel + reconciled final. Pick a team in the chat top bar to use it.</p>
        {props.teams.map((t) => (
          <div key={t.id} className="modelrow">
            <div style={{ flex: 1 }}>
              <div><b>{t.name}</b> <span className="pill">{t.strategy}</span></div>
              <div style={{ fontSize: 12, color: "var(--mut)" }}>{t.members.join(" · ")}</div>
            </div>
            <button className={`minibtn${props.activeTeam === t.id ? " on" : ""}`} onClick={() => props.onSelect(props.activeTeam === t.id ? "" : t.id)}>
              {props.activeTeam === t.id ? "✓ Active" : "Use"}
            </button>
            <button className="minibtn danger" onClick={() => remove(t.id)}>Delete</button>
          </div>
        ))}
        {props.teams.length === 0 && <div className="empty">No teams yet — create one below.</div>}
      </div>
      <div className="card"><div className="form">
        <h3 style={{ margin: 0 }}>+ New team</h3>
        <label>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Code Squad" />
        <label>Strategy</label>
        <select value={strategy} onChange={(e) => setStrategy(e.target.value as Team["strategy"])}>
          <option value="vote">Vote (parallel → merge)</option>
          <option value="pipeline">Pipeline (chain improvements)</option>
          <option value="debate">Debate (parallel → reconcile)</option>
        </select>
        <label>Members (up to 8) — {members.length} selected</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {avail.map((m) => (
            <button key={m.id} className={`minibtn${members.includes(m.id) ? " on" : ""}`} onClick={() => toggle(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <button className="btn primary" onClick={create} disabled={busy || !name.trim() || !members.length}>
          Create team
        </button>
      </div></div>
    </div></div>
  );
}

"use client";
import { useEffect, useState } from "react";
import type { McpServer } from "@/lib/types";

export default function McpPanel(props: { servers: McpServer[]; onChanged: () => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<"mcp" | "llm">("llm");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  // GitHub
  const [ghConnected, setGhConnected] = useState(false);
  const [ghPat, setGhPat] = useState("");
  const [ghRepos, setGhRepos] = useState<{ full_name: string; branch: string }[]>([]);

  useEffect(() => {
    fetch("/api/connections/github").then((r) => r.json()).then((j) => setGhConnected(!!j.connected));
  }, []);

  const add = async () => {
    if (!name.trim() || !url.trim()) return;
    setBusy(true);
    await fetch("/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, url, kind, apiKey, models }),
    });
    setName(""); setUrl(""); setApiKey(""); setModels("");
    setBusy(false);
    props.onChanged();
  };

  const test = async (id: string) => {
    setTesting(id);
    await fetch(`/api/mcp/${id}`, { method: "POST" });
    setTesting(null);
    props.onChanged();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove connection?")) return;
    await fetch(`/api/mcp/${id}`, { method: "DELETE" });
    props.onChanged();
  };

  const ghConnect = async () => {
    const j = await fetch("/api/connections/github", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "connect", pat: ghPat }),
    }).then((r) => r.json());
    if (j.ok) { setGhConnected(true); setGhPat(""); }
    else alert(j.error || "connect failed");
  };

  const ghReposLoad = async () => {
    const j = await fetch("/api/connections/github", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "repos" }),
    }).then((r) => r.json());
    if (j.repos) setGhRepos(j.repos);
    else alert(j.error || "failed");
  };

  return (
    <div className="panel"><div className="panel-inner">
      <div className="card"><div className="form">
        <h3 style={{ margin: 0 }}>🔌 Add connection — new AI or MCP server</h3>
        <p>Type <b>AI endpoint</b> = any OpenAI-compatible base URL (joins the auto-switch router).
        Type <b>MCP</b> = tool server (handshake-tested, ready for agent tools).</p>
        <div className="grid2">
          <div className="form">
            <label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="My AI / My MCP" />
          </div>
          <div className="form">
            <label>Type</label>
            <select value={kind} onChange={(e) => setKind(e.target.value as "mcp" | "llm")}>
              <option value="llm">AI endpoint (OpenAI-compatible)</option>
              <option value="mcp">MCP server</option>
            </select>
          </div>
        </div>
        <label>URL {kind === "llm" ? "(base, e.g. https://api.vendor.com/v1)" : "(e.g. https://mcp.example.com/mcp)"}</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
        <div className="grid2">
          <div className="form">
            <label>API key (optional)</label>
            <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-…" type="password" />
          </div>
          <div className="form">
            <label>Models (comma-separated, for AI type)</label>
            <input value={models} onChange={(e) => setModels(e.target.value)} placeholder="model-a, model-b" />
          </div>
        </div>
        <button className="btn primary" onClick={add} disabled={busy || !name.trim() || !url.trim()}>Add connection</button>
      </div></div>

      <div className="card">
        <h3>Connections ({props.servers.length})</h3>
        {props.servers.map((s) => (
          <div key={s.id} className="modelrow">
            <div style={{ flex: 1 }}>
              <div><b>{s.name}</b> <span className="pill">{s.kind === "llm" ? "AI" : "MCP"}</span></div>
              <div style={{ fontSize: 12, color: "var(--mut)" }}>{s.url}{s.models?.length ? ` · ${s.models.join(", ")}` : ""}</div>
              {s.lastStatus && <div style={{ fontSize: 12, color: "var(--mut)" }}>last test: {s.lastStatus}</div>}
            </div>
            <button className="minibtn" onClick={() => test(s.id)} disabled={testing === s.id}>
              {testing === s.id ? "…" : "Test"}
            </button>
            <button className="minibtn danger" onClick={() => remove(s.id)}>Remove</button>
          </div>
        ))}
        {props.servers.length === 0 && <div className="empty">No connections yet.</div>}
      </div>

      <div className="card"><div className="form">
        <h3 style={{ margin: 0 }}>🐙 GitHub</h3>
        <p>Connect to browse repos and pull files into builds. {ghConnected ? "Connected ✓" : "Not connected."}</p>
        {!ghConnected ? (
          <div style={{ display: "flex", gap: 8 }}>
            <input value={ghPat} onChange={(e) => setGhPat(e.target.value)} placeholder="GitHub PAT (repo scope)" type="password" style={{ flex: 1 }} />
            <button className="btn primary" onClick={ghConnect}>Connect</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn" onClick={ghReposLoad}>List my repos</button>
            <button className="btn danger" onClick={async () => {
              await fetch("/api/connections/github", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "disconnect" }) });
              setGhConnected(false); setGhRepos([]);
            }}>Disconnect</button>
          </div>
        )}
        {ghRepos.map((r) => (
          <div key={r.full_name} className="kv"><span>{r.full_name}</span><span>{r.branch}</span></div>
        ))}
      </div></div>
    </div></div>
  );
}

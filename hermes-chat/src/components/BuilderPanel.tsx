"use client";
import { useEffect, useState } from "react";
import type { Build } from "@/lib/types";

export default function BuilderPanel(props: { attachedIds: string[] }) {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [prompt, setPrompt] = useState("");
  const [stack, setStack] = useState("web (html/css/js)");
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Build | null>(null);
  const [fileView, setFileView] = useState<{ file: string; content: string } | null>(null);
  const [fix, setFix] = useState("");

  const refresh = async () => {
    const j = await fetch("/api/builder").then((r) => r.json());
    setBuilds(j.builds ?? []);
  };
  useEffect(() => { refresh(); }, []);

  const start = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const j = await fetch("/api/builder", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, stack, fileIds: props.attachedIds }),
      }).then((r) => r.json());
      if (j.build) { setSel(j.build); await refresh(); }
      else alert(j.error || "build failed");
    } finally { setBusy(false); }
  };

  const openBuild = async (id: string) => {
    const j = await fetch(`/api/builder/${id}`).then((r) => r.json());
    if (j.build) { setSel(j.build); setFileView(null); }
  };

  const openFile = async (f: string) => {
    if (!sel) return;
    const j = await fetch(`/api/builder/${sel.id}?file=${encodeURIComponent(f)}`).then((r) => r.json());
    if (j.content !== undefined) setFileView({ file: f, content: j.content });
  };

  const sendFix = async () => {
    if (!sel || !fix.trim()) return;
    setBusy(true);
    try {
      const j = await fetch(`/api/builder/${sel.id}`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ instruction: fix }),
      }).then((r) => r.json());
      if (j.build) { setSel(j.build); setFix(""); await refresh(); }
      else alert(j.error || "fix failed");
    } finally { setBusy(false); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete build?")) return;
    await fetch(`/api/builder/${id}`, { method: "DELETE" });
    if (sel?.id === id) { setSel(null); setFileView(null); }
    refresh();
  };

  return (
    <div className="panel"><div className="panel-inner">
      <div className="card"><div className="form">
        <h3 style={{ margin: 0 }}>🏗 App Builder — prompt (+ attached files) → working app</h3>
        <p>Attach reference files in the chat panel first if you want “build from files”. {props.attachedIds.length} attached.</p>
        <label>Stack</label>
        <select value={stack} onChange={(e) => setStack(e.target.value)}>
          <option>web (html/css/js)</option>
          <option>nextjs</option>
          <option>python</option>
          <option>node api</option>
          <option>static site</option>
        </select>
        <label>Prompt</label>
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
          placeholder="e.g. Build a todo app with localStorage, dark mode, and filters…" />
        <button className="btn primary" onClick={start} disabled={busy || !prompt.trim()}>
          {busy ? "Building…" : "🚀 Build app"}
        </button>
      </div></div>

      <div className="grid2">
        <div className="card">
          <h3>Builds ({builds.length})</h3>
          {builds.map((b) => (
            <div key={b.id} className="modelrow">
              <div style={{ flex: 1 }}>
                <div><b>{b.stack}</b> <span className={`pill ${b.status === "done" ? "ok" : b.status === "error" ? "err" : "warn"}`}>{b.status}</span></div>
                <div style={{ fontSize: 12, color: "var(--mut)" }}>{b.prompt.slice(0, 90)}… · {b.files.length} files</div>
              </div>
              <button className="minibtn" onClick={() => openBuild(b.id)}>Open</button>
              <button className="minibtn danger" onClick={() => del(b.id)}>✕</button>
            </div>
          ))}
          {builds.length === 0 && <div className="empty">No builds yet.</div>}
        </div>
        <div className="card">
          <h3>{sel ? `Build ${sel.id}` : "Select a build"}</h3>
          {!sel && <div className="empty">Open a build to see files, logs, and iterate.</div>}
          {sel && (
            <div className="form">
              {sel.modelId && <div className="kv"><span>model</span><span>{sel.modelId}</span></div>}
              <label>Files</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {sel.files.map((f) => (
                  <button key={f} className="minibtn" onClick={() => openFile(f)}>{f}</button>
                ))}
              </div>
              {fileView && (
                <div className="log" style={{ maxHeight: 320 }}><b>{fileView.file}</b>{"\n\n"}{fileView.content.slice(0, 20000)}</div>
              )}
              <label>Log</label>
              <div className="log">{sel.log.join("\n")}</div>
              <label>Fix / iterate (always-best loop)</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={fix} onChange={(e) => setFix(e.target.value)} placeholder="e.g. add a dark-mode toggle" style={{ flex: 1 }} />
                <button className="btn" onClick={sendFix} disabled={busy || !fix.trim()}>Fix</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div></div>
  );
}

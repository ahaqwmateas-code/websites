"use client";
import type { ModelStatus } from "@/lib/types";

export default function ModelsPanel(props: { models: ModelStatus[]; date: string; onRefresh: () => void }) {
  const avail = props.models.filter((m) => m.available).length;
  return (
    <div className="panel"><div className="panel-inner">
      <div className="card">
        <h3>🧠 Model router — {props.date}</h3>
        <p>{avail}/{props.models.length} available · free tiers first · auto-switches when a daily limit or error is hit.
        Free ≈ paid via quality-boost prompting + team synthesis.</p>
        <button className="btn" onClick={props.onRefresh}>↻ Refresh status</button>
      </div>
      <div className="card">
        {props.models.map((m) => (
          <div key={m.id} className="modelrow">
            <span className={`dot ${m.available ? "g" : m.reason === "daily limit reached" ? "y" : "r"}`} />
            <div style={{ flex: 1 }}>
              <div><b>{m.label}</b> {m.free && <span className="pill">free</span>}</div>
              <div style={{ fontSize: 12, color: "var(--mut)" }}>
                {m.id} · used {m.usedToday}{m.dailyLimit > 0 ? `/${m.dailyLimit}` : " (unlimited)"}
                {m.reason && ` · ${m.reason}`}
              </div>
            </div>
            <span className={`pill ${m.available ? "ok" : m.reason === "daily limit reached" ? "warn" : "err"}`}>
              {m.available ? "ready" : m.reason}
            </span>
          </div>
        ))}
        {props.models.length === 0 && <div className="empty">No models registered.</div>}
      </div>
      <div className="card">
        <h3>🔑 Get free keys</h3>
        <p>
          <a href="https://console.groq.com" target="_blank" rel="noreferrer">Groq</a> ·
          {" "}<a href="https://aistudio.google.com" target="_blank" rel="noreferrer">Gemini</a> ·
          {" "}<a href="https://openrouter.ai" target="_blank" rel="noreferrer">OpenRouter</a> ·
          {" "}<a href="https://together.ai" target="_blank" rel="noreferrer">Together</a> ·
          {" "}<a href="https://huggingface.co" target="_blank" rel="noreferrer">HuggingFace</a>
          {" "}— paste into <code>hermes-chat/.env</code> and restart. Or run <code>ollama serve</code> for keyless local.
        </p>
      </div>
    </div></div>
  );
}

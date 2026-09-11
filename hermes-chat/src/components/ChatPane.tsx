"use client";
import { useEffect, useRef, useState } from "react";
import type { Msg, UploadMeta } from "@/lib/types";

function renderMd(text: string) {
  // Minimal markdown: code fences, inline code, bold, headings, line breaks.
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts = text.split(/```/);
  let html = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      const nl = parts[i].indexOf("\n");
      const code = nl >= 0 ? parts[i].slice(nl + 1) : parts[i];
      html += `<pre><code>${esc(code)}</code></pre>`;
    } else {
      let t = esc(parts[i]);
      t = t
        .replace(/^#### (.*)$/gm, "<h4>$1</h4>")
        .replace(/^### (.*)$/gm, "<h3>$1</h3>")
        .replace(/^## (.*)$/gm, "<h2>$1</h2>")
        .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
        .replace(/`([^`\n]+)`/g, "<code>$1</code>")
        .replace(/\n/g, "<br/>");
      html += t;
    }
  }
  return html;
}

export default function ChatPane(props: {
  messages: Msg[];
  loading: boolean;
  lastMeta: { modelId?: string; switched?: boolean; demo?: boolean; teamId?: string } | null;
  attached: UploadMeta[];
  onRemoveAttach: (id: string) => void;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [props.messages, props.loading]);

  const send = () => {
    const t = draft.trim();
    if (!t || props.loading) return;
    setDraft("");
    props.onSend(t);
  };

  const visible = props.messages.filter((m) => m.role !== "system");

  return (
    <>
      <div className="chat">
        <div className="chat-inner">
          {visible.length === 0 && (
            <div className="empty">
              <h2 style={{ color: "var(--txt)" }}>⚡ Hermes Chat</h2>
              <p>Every free AI, one box. Router auto-switches when a daily limit is hit.<br />
              Attach files from the right panel · Build apps in Builder · Group models in Teams.</p>
            </div>
          )}
          {visible.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="bubble user">{m.content}</div>
            ) : (
              <div key={i} className="bubble ai">
                <div dangerouslySetInnerHTML={{ __html: renderMd(m.content) }} />
              </div>
            )
          )}
          {props.loading && <div className="bubble ai typing">Hermes is thinking…</div>}
          {props.lastMeta?.modelId && (
            <div className="meta">
              <span>model: {props.lastMeta.modelId}</span>
              {props.lastMeta.teamId && <span>team: {props.lastMeta.teamId}</span>}
              {props.lastMeta.switched && <span>· auto-switched ✓</span>}
              {props.lastMeta.demo && <span style={{ color: "var(--warn)" }}>· demo mode (add a key)</span>}
            </div>
          )}
          <div ref={bottom} />
        </div>
      </div>
      <div className="composer">
        <div className="composer-inner">
          {props.attached.length > 0 && (
            <div className="attached">
              {props.attached.map((f) => (
                <span key={f.id} className="chip">
                  📎 {f.name}
                  <button onClick={() => props.onRemoveAttach(f.id)} title="remove">✕</button>
                </span>
              ))}
            </div>
          )}
          <div className="box">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
              }}
              placeholder="Message Hermes… (Enter to send, Shift+Enter for newline)"
            />
            <button className="send" onClick={send} disabled={props.loading || !draft.trim()}>
              {props.loading ? "…" : "Send"}
            </button>
          </div>
          <div className="hint">Free-tier router · auto-fallback on limits/errors · files persist until you delete them</div>
        </div>
      </div>
    </>
  );
}

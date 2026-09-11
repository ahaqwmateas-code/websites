"use client";
import { useRef, useState } from "react";
import { fmtBytes, type UploadMeta } from "@/lib/types";

async function uploadFile(file: File, onProg: (pct: number) => void): Promise<UploadMeta> {
  const init = await fetch("/api/uploads/init", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: file.name, size: file.size, type: file.type }),
  }).then((r) => r.json());
  if (!init.id) throw new Error(init.error || "init failed");
  const chunk: number = init.chunkBytes || 5 * 1024 * 1024;
  let offset = 0;
  while (offset < file.size) {
    const slice = file.slice(offset, offset + chunk);
    const r = await fetch(`/api/uploads/chunk?id=${init.id}&offset=${offset}`, {
      method: "POST",
      body: slice,
    });
    if (!r.ok) throw new Error("chunk failed at " + offset);
    offset += slice.size;
    onProg(Math.round((offset / file.size) * 100));
  }
  // zero-byte files: skip chunk loop, still complete
  const done = await fetch("/api/uploads/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: init.id, name: file.name, size: file.size, type: file.type }),
  }).then((r) => r.json());
  if (!done.ok) throw new Error(done.error || "complete failed");
  return done.file as UploadMeta;
}

export default function UploadPanel(props: {
  uploads: UploadMeta[];
  selected: string[];
  onToggle: (id: string) => void;
  onChanged: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [prog, setProg] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  const put = async (files: FileList | File[]) => {
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        setProg((p) => ({ ...p, [f.name]: 0 }));
        await uploadFile(f, (pct) => setProg((p) => ({ ...p, [f.name]: pct })));
        setProg((p) => { const n = { ...p }; delete n[f.name]; return n; });
      }
      props.onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "upload failed");
    } finally {
      setBusy(false);
    }
  };

  const delOne = async (id: string) => {
    if (!confirm("Delete this file?")) return;
    await fetch(`/api/uploads/${id}`, { method: "DELETE" });
    props.onChanged();
  };

  const delAll = async () => {
    if (!props.uploads.length) return;
    if (!confirm(`Delete ALL ${props.uploads.length} files?`)) return;
    await fetch("/api/uploads", { method: "DELETE" });
    props.onChanged();
  };

  return (
    <>
      <h3>📎 Files — kept until you delete</h3>
      <div className="tools">
        <button className="minibtn" onClick={() => input.current?.click()} disabled={busy}>
          + Upload
        </button>
        <button className="minibtn danger" onClick={delAll} disabled={!props.uploads.length}>
          🗑 Delete all ({props.uploads.length})
        </button>
      </div>
      <div
        className={`drop${over ? " over" : ""}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) put(e.dataTransfer.files); }}
      >
        Drop files here or click — no size limit (5MB chunks)
      </div>
      <input
        ref={input} type="file" multiple hidden
        onChange={(e) => { if (e.target.files?.length) put(e.target.files); e.target.value = ""; }}
      />
      {Object.entries(prog).map(([n, p]) => (
        <div key={n} style={{ padding: "0 14px 8px", fontSize: 12 }}>
          {n} — {p}%<div className="progress"><div style={{ width: `${p}%` }} /></div>
        </div>
      ))}
      <div className="filelist">
        {props.uploads.length === 0 && <div className="empty">No files yet.</div>}
        {props.uploads.map((u) => (
          <div key={u.id} className="filecard">
            <div className="nm" title={u.name}>{u.name}</div>
            <div className="mt">{fmtBytes(u.size)} · {new Date(u.createdAt).toLocaleString()}</div>
            <div className="ops">
              <button
                className={`minibtn${props.selected.includes(u.id) ? " on" : ""}`}
                onClick={() => props.onToggle(u.id)}
                title="Attach to chat context"
              >
                {props.selected.includes(u.id) ? "✓ Attached" : "Attach"}
              </button>
              <a className="minibtn" href={`/api/uploads/${u.id}`} style={{ textDecoration: "none" }}>⬇</a>
              <button className="minibtn danger" onClick={() => delOne(u.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

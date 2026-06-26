"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, EmptyState } from "./ui";
import { Mail, Send, Trash2, Loader2, ChevronDown } from "lucide-react";

interface OutreachItem {
  id: string;
  company: string;
  recruiterName: string;
  recruiterEmail: string;
  subject: string;
  body: string;
  status: string;
  error: string;
  job: { title: string; company: string } | null;
}

const STATUS_STYLE: Record<string, string> = {
  draft: "!border-slate-500/30 text-slate-300",
  approved: "!border-sky-500/30 text-sky-300",
  sent: "!border-emerald-500/30 text-emerald-300",
  failed: "!border-rose-500/30 text-rose-300",
};

export default function OutreachManager({
  initial, smtp, emailMode,
}: {
  initial: OutreachItem[]; smtp: boolean; emailMode: "review" | "auto";
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState("");

  function patch(id: string, p: Partial<OutreachItem>) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }

  async function save(item: OutreachItem) {
    setBusy(item.id + "-save");
    await fetch(`/api/outreach/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: item.subject, body: item.body, recruiterEmail: item.recruiterEmail, recruiterName: item.recruiterName }),
    });
    setBusy("");
  }

  async function send(item: OutreachItem) {
    setBusy(item.id + "-send");
    await save(item);
    const res = await fetch(`/api/outreach/${item.id}/send`, { method: "POST" });
    const d = await res.json();
    setBusy("");
    if (d.ok) patch(item.id, { status: "sent", error: "" });
    else patch(item.id, { status: "failed", error: d.error || "send failed" });
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Delete this draft?")) return;
    await fetch(`/api/outreach/${id}`, { method: "DELETE" });
    setItems((xs) => xs.filter((x) => x.id !== id));
  }

  return (
    <div>
      <PageHeader title="Outreach" subtitle={`Recruiter emails · mode: ${emailMode}`} />
      {!smtp && (
        <div className="card mb-4 border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
          Configure <code className="rounded bg-black/30 px-1">SMTP_USER</code> and{" "}
          <code className="rounded bg-black/30 px-1">SMTP_PASSWORD</code> in .env to send emails. You can still draft and edit them.
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState title="No outreach yet" hint="Open a job and use the Outreach tab to draft a recruiter email." />
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="card overflow-hidden">
              <button onClick={() => setOpenId(openId === it.id ? null : it.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-brand-400" />
                    <span className="truncate text-sm font-medium">{it.subject || "(no subject)"}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-400">
                    {(it.job?.title || it.company || "—")} · {it.recruiterEmail || "no recipient"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`chip ${STATUS_STYLE[it.status] || ""}`}>{it.status}</span>
                  <ChevronDown className={`h-4 w-4 text-slate-400 transition ${openId === it.id ? "rotate-180" : ""}`} />
                </div>
              </button>

              {openId === it.id && (
                <div className="space-y-3 border-t border-white/10 p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><label className="label">Recruiter name</label><input className="input" value={it.recruiterName} onChange={(e) => patch(it.id, { recruiterName: e.target.value })} /></div>
                    <div><label className="label">Recruiter email</label><input className="input" value={it.recruiterEmail} onChange={(e) => patch(it.id, { recruiterEmail: e.target.value })} /></div>
                  </div>
                  <div><label className="label">Subject</label><input className="input" value={it.subject} onChange={(e) => patch(it.id, { subject: e.target.value })} /></div>
                  <div><label className="label">Body</label><textarea className="input h-44 resize-none" value={it.body} onChange={(e) => patch(it.id, { body: e.target.value })} /></div>
                  {it.error && <p className="text-xs text-rose-400">Error: {it.error}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => save(it)} disabled={!!busy} className="btn-ghost">
                      {busy === it.id + "-save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
                    </button>
                    <button onClick={() => send(it)} disabled={!!busy || !smtp || it.status === "sent"} className="btn-primary">
                      {busy === it.id + "-send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {it.status === "sent" ? "Sent" : "Send"}
                    </button>
                    <button onClick={() => remove(it.id)} className="btn-danger ml-auto"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

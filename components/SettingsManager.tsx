"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppSettings } from "@/lib/settings";
import { PageHeader } from "./ui";
import { Save, Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

interface SourceLite { id: string; label: string; requiresKey: boolean; }

export default function SettingsManager({
  initial, caps, sources, linkedinSession,
}: {
  initial: AppSettings;
  caps: { ai: boolean; adzuna: boolean; smtp: boolean; aiProvider?: string; aiModel?: string; aiEnvHint?: string };
  sources: SourceLite[];
  linkedinSession: boolean;
}) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function toggleSource(id: string) {
    setS((cur) => ({
      ...cur,
      enabledSources: cur.enabledSources.includes(id)
        ? cur.enabledSources.filter((x) => x !== id)
        : [...cur.enabledSources, id],
    }));
  }

  async function save() {
    setSaving(true);
    setMsg("");
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(s),
    });
    setSaving(false);
    setMsg("Settings saved ✓");
    setTimeout(() => setMsg(""), 3000);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Settings" subtitle="Configure JobPilot. Secrets (API keys, SMTP password) live in your .env file.">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save
        </button>
      </PageHeader>
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}

      {/* Capabilities */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold">Integrations (.env)</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <CapCard
            label={`AI — ${caps.aiProvider || "LLM"}`}
            ok={caps.ai}
            hint={caps.ai ? caps.aiModel || "" : `${caps.aiEnvHint || "LLM_PROVIDER"} · set LLM_PROVIDER`}
          />
          <CapCard label="Adzuna jobs" ok={caps.adzuna} hint="ADZUNA_APP_ID / KEY" />
          <CapCard label="Email — SMTP" ok={caps.smtp} hint="SMTP_USER / PASSWORD" />
        </div>
      </div>

      {/* Job sources */}
      <div className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Default job sources</h2>
        <p className="mb-3 text-xs text-slate-400">Which sources to query when you click Discover.</p>
        <div className="flex flex-wrap gap-2">
          {sources.map((src) => (
            <button
              key={src.id}
              onClick={() => toggleSource(src.id)}
              className={`chip cursor-pointer ${s.enabledSources.includes(src.id) ? "!border-brand-500/50 !bg-brand-500/15 text-brand-200" : ""}`}
            >
              {src.label}{src.requiresKey && <span className="text-[10px] text-amber-300">key</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Email mode */}
      <div className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Recruiter email mode</h2>
        <p className="mb-3 text-xs text-slate-400">How outreach emails are handled after they're drafted.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModeCard
            active={s.emailMode === "review"}
            onClick={() => setS({ ...s, emailMode: "review" })}
            title="Review &amp; send"
            desc="Drafts wait in Outreach for you to edit and approve before sending. Recommended."
          />
          <ModeCard
            active={s.emailMode === "auto"}
            onClick={() => setS({ ...s, emailMode: "auto" })}
            title="Auto-send"
            desc="Emails send immediately when drafted (needs SMTP + a recipient). Higher spam risk."
          />
        </div>
        <div className="mt-4">
          <label className="label">From name (optional)</label>
          <input className="input max-w-sm" value={s.smtpFromName} onChange={(e) => setS({ ...s, smtpFromName: e.target.value })} placeholder="Defaults to your profile name" />
        </div>
      </div>

      {/* Match threshold */}
      <div className="card p-5">
        <h2 className="mb-1 text-sm font-semibold">Match threshold</h2>
        <p className="mb-3 text-xs text-slate-400">Jobs at or above this score are highlighted as priorities ({s.matchThreshold}%).</p>
        <input type="range" min={0} max={100} step={5} value={s.matchThreshold} onChange={(e) => setS({ ...s, matchThreshold: Number(e.target.value) })} className="w-full max-w-md accent-brand-500" />
      </div>

      {/* LinkedIn automation */}
      <div className="card border-amber-500/30 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-amber-200">LinkedIn automation (advanced, opt-in)</h2>
            <p className="mt-1 text-xs text-amber-200/80">
              Automating LinkedIn (scraping listings, auto Easy-Apply) <strong>violates LinkedIn's Terms of
              Service</strong> and can get your account restricted or banned. Use entirely at your own risk.
              Capture a session first with <code className="rounded bg-black/30 px-1">npm run linkedin:login</code>.
            </p>
            <div className="mt-3 flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={s.automationEnabled} onChange={(e) => setS({ ...s, automationEnabled: e.target.checked })} className="accent-amber-500" />
                Enable LinkedIn automation
              </label>
              <span className={`chip ${linkedinSession ? "!border-emerald-500/30 text-emerald-300" : "!border-slate-500/30 text-slate-400"}`}>
                session {linkedinSession ? "captured" : "not found"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CapCard({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm">{label}</span>
        {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <XCircle className="h-4 w-4 text-slate-500" />}
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
    </div>
  );
}

function ModeCard({ active, onClick, title, desc }: { active: boolean; onClick: () => void; title: string; desc: string }) {
  return (
    <button onClick={onClick} className={`rounded-xl border p-4 text-left transition ${active ? "border-brand-500/60 bg-brand-500/10" : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05]"}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" dangerouslySetInnerHTML={{ __html: title }} />
        {active && <CheckCircle2 className="h-4 w-4 text-brand-400" />}
      </div>
      <p className="mt-1 text-xs text-slate-400">{desc}</p>
    </button>
  );
}

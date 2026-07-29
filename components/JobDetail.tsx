"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { markdownToHtml } from "@/lib/resume/markdown";
import { MatchAnalysis, AtsKeywords, AutofillData, JOB_STATUSES } from "@/lib/types";
import { MatchBadge } from "./ui";
import ApplyKit from "./ApplyKit";
import {
  ArrowLeft, FileText, Mail, Sparkles, MessagesSquare, Send, ExternalLink, Loader2,
  Download, CheckCircle2, AlertTriangle, Building2, MapPin,
} from "lucide-react";

interface JobFull {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: string;
  salary: string;
  remote: boolean;
  status: string;
  matchScore: number | null;
  descriptionText: string;
  application: {
    tailoredResumeMd: string;
    resumePdfPath: string;
    coverLetter: string;
    sourceResumeMd: string;
    status: string;
    method: string;
    notes: string;
  } | null;
  outreach: { id: string; subject: string; body: string; status: string; recruiterEmail: string }[];
}

type Tab = "description" | "match" | "resume" | "cover" | "outreach" | "interview";

export default function JobDetail({
  job,
  analysis,
  ats,
  caps,
  emailMode,
  automationEnabled,
  autofill,
  hasBaseResume,
}: {
  job: JobFull;
  analysis: MatchAnalysis;
  ats: AtsKeywords;
  caps: { ai: boolean; smtp: boolean; adzuna: boolean; aiProvider?: string; aiEnvHint?: string };
  emailMode: "review" | "auto";
  automationEnabled: boolean;
  autofill: AutofillData;
  hasBaseResume: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("description");
  const [status, setStatus] = useState(job.status);

  const [resumeMd, setResumeMd] = useState(job.application?.tailoredResumeMd || "");
  const [pdfPath, setPdfPath] = useState(job.application?.resumePdfPath || "");
  const [atsState, setAtsState] = useState(ats);
  const [coverLetter, setCoverLetter] = useState(job.application?.coverLetter || "");
  const [prep, setPrep] = useState<{ q: string; tip: string }[]>([]);

  const [loading, setLoading] = useState<string>("");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 5000);
  }

  async function call(path: string, body?: unknown) {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  async function tailor() {
    setLoading("resume");
    try {
      const d = await call(`/api/jobs/${job.id}/tailor`);
      setResumeMd(d.tailoredResumeMd);
      setPdfPath(d.resumePdfPath);
      setAtsState(d.ats);
      setStatus("tailored");
      setTab("resume");
      flash("ok", d.pdfOk ? "Resume tailored + PDF generated." : "Resume tailored (PDF render skipped).");
      router.refresh();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading("");
    }
  }

  async function cover() {
    setLoading("cover");
    try {
      const d = await call(`/api/jobs/${job.id}/cover-letter`);
      setCoverLetter(d.coverLetter);
      setTab("cover");
      flash("ok", "Cover letter generated.");
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading("");
    }
  }

  async function interview() {
    setLoading("interview");
    try {
      const d = await call(`/api/jobs/${job.id}/interview-prep`);
      setPrep(d.questions || []);
      setTab("interview");
      flash("ok", "Interview prep ready.");
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading("");
    }
  }

  async function changeStatus(s: string) {
    setStatus(s);
    await fetch(`/api/jobs/${job.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: s }),
    });
    router.refresh();
  }

  async function apply(method: "assisted" | "linkedin") {
    setLoading(`apply-${method}`);
    try {
      const d = await call(`/api/jobs/${job.id}/apply`, { method });
      if (d.ok) {
        setStatus("applied");
        flash("ok", d.message || "Marked as applied.");
        router.refresh();
      } else {
        flash("err", d.error || "Could not apply automatically.");
      }
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading("");
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "description", label: "Description" },
    { id: "match", label: "Match" },
    { id: "resume", label: "Resume" },
    { id: "cover", label: "Cover letter" },
    { id: "outreach", label: "Outreach" },
    { id: "interview", label: "Interview prep" },
  ];

  return (
    <div className="space-y-5">
      <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Back to jobs
      </Link>

      {/* Header */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{job.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
              <span className="inline-flex items-center gap-1"><Building2 className="h-4 w-4" />{job.company || "—"}</span>
              {job.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{job.location}</span>}
              {job.salary && <span className="text-emerald-300">{job.salary}</span>}
              <span className="chip">{job.source}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <MatchBadge score={job.matchScore} />
            <select value={status} onChange={(e) => changeStatus(e.target.value)} className="input w-auto py-1 text-xs">
              {JOB_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* Action toolbar */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={tailor} disabled={!!loading} className="btn-primary" title={caps.ai ? "" : `Needs an LLM provider (${caps.aiEnvHint || "LLM_PROVIDER"})`}>
            {loading === "resume" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Tailor resume
          </button>
          <button onClick={cover} disabled={!!loading} className="btn-ghost">
            {loading === "cover" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Cover letter
          </button>
          <button onClick={interview} disabled={!!loading} className="btn-ghost">
            {loading === "interview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessagesSquare className="h-4 w-4" />}
            Interview prep
          </button>
          {job.url && (
            <a href={job.url} target="_blank" rel="noreferrer" className="btn-ghost">
              <ExternalLink className="h-4 w-4" /> Open posting
            </a>
          )}
        </div>

        {!caps.ai && (
          <p className="mt-3 text-xs text-amber-300">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            AI features need an LLM provider configured in .env — set LLM_PROVIDER (claude / groq / gemini / custom) and its key (match scoring falls back to a heuristic).
          </p>
        )}
      </div>

      {toast && (
        <div className={`card px-4 py-3 text-sm ${toast.kind === "ok" ? "border-emerald-500/30 text-emerald-200" : "border-rose-500/30 text-rose-200"}`}>
          {toast.kind === "ok" ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : <AlertTriangle className="mr-2 inline h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-3 py-2 text-sm transition ${
              tab === t.id ? "border-b-2 border-brand-500 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {tab === "description" && (
            <div className="card whitespace-pre-wrap p-5 text-sm leading-relaxed text-slate-300">
              {job.descriptionText || "No description available."}
            </div>
          )}

          {tab === "match" && <MatchPanel analysis={analysis} score={job.matchScore} />}

          {tab === "resume" && (
            <ResumePanel resumeMd={resumeMd} pdfPath={pdfPath} ats={atsState} onTailor={tailor} loading={loading === "resume"} />
          )}

          {tab === "cover" && (
            <CoverPanel coverLetter={coverLetter} onGenerate={cover} loading={loading === "cover"} />
          )}

          {tab === "outreach" && (
            <OutreachPanel job={job} caps={caps} emailMode={emailMode} onChanged={() => router.refresh()} />
          )}

          {tab === "interview" && (
            <InterviewPanel prep={prep} onGenerate={interview} loading={loading === "interview"} />
          )}
        </div>

        {/* Apply rail */}
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-3 text-sm font-semibold">Apply</h3>
            <ApplyKit
              job={{ id: job.id, title: job.title, company: job.company, url: job.url, source: job.source }}
              initialAutofill={autofill}
              initialSourceResumeMd={job.application?.sourceResumeMd || ""}
              hasBaseResume={hasBaseResume}
              aiEnabled={caps.ai}
              automationEnabled={automationEnabled}
              applicationStatus={job.status}
              onApplied={() => router.refresh()}
              compact
            />
            {job.url.includes("linkedin.com") && (
              <button
                onClick={() => apply("linkedin")}
                disabled={!!loading || !automationEnabled}
                className="btn-ghost mt-3 w-full"
                title={automationEnabled ? "Attempt LinkedIn Easy Apply" : "Enable automation in Settings (at your own risk)"}
              >
                {loading === "apply-linkedin" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                LinkedIn auto-apply
              </button>
            )}
            {job.application?.notes && (
              <p className="mt-3 text-xs text-slate-400">Note: {job.application.notes}</p>
            )}
          </div>

          <div className="card p-5">
            <h3 className="mb-2 text-sm font-semibold">Quick reach out</h3>
            <p className="mb-3 text-xs text-slate-400">Draft a recruiter email for this role.</p>
            <button onClick={() => setTab("outreach")} className="btn-ghost w-full">
              <Sparkles className="h-4 w-4" /> Go to outreach
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MatchPanel({ analysis, score }: { analysis: MatchAnalysis; score: number | null }) {
  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center gap-3">
        <div className="text-3xl font-bold text-brand-300">{score ?? "—"}{score !== null && "%"}</div>
        <p className="text-sm text-slate-300">{analysis.rationale || "Not yet analyzed."}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <KeywordList title="Strengths" items={analysis.strengths} tone="ok" />
        <KeywordList title="Gaps" items={analysis.gaps} tone="warn" />
      </div>
      {analysis.missingKeywords.length > 0 && (
        <div>
          <div className="label">Missing keywords</div>
          <div className="flex flex-wrap gap-1.5">
            {analysis.missingKeywords.map((k) => (
              <span key={k} className="chip !border-rose-500/30 text-rose-300">{k}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KeywordList({ title, items, tone }: { title: string; items: string[]; tone: "ok" | "warn" }) {
  return (
    <div>
      <div className="label">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">—</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {items.map((s, i) => (
            <li key={i} className={tone === "ok" ? "text-emerald-300" : "text-amber-300"}>• {s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ResumePanel({
  resumeMd, pdfPath, ats, onTailor, loading,
}: {
  resumeMd: string; pdfPath: string; ats: AtsKeywords; onTailor: () => void; loading: boolean;
}) {
  if (!resumeMd) {
    return (
      <div className="card grid place-items-center gap-3 p-10 text-center">
        <p className="text-slate-400">No tailored resume yet.</p>
        <button onClick={onTailor} disabled={loading} className="btn-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          Tailor resume to this job
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {(ats.present.length > 0 || ats.missing.length > 0) && (
        <div className="card p-4">
          <div className="label">ATS keyword check</div>
          <div className="flex flex-wrap gap-1.5">
            {ats.present.map((k) => <span key={k} className="chip !border-emerald-500/30 text-emerald-300">{k}</span>)}
            {ats.missing.map((k) => <span key={k} className="chip !border-rose-500/30 text-rose-300 line-through">{k}</span>)}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">Green = present in your tailored resume · Red = still missing</p>
        </div>
      )}
      <div className="card p-6">
        <div className="prose-resume" dangerouslySetInnerHTML={{ __html: markdownToHtml(resumeMd) }} />
      </div>
      {pdfPath && (
        <a href={`/api/storage${pdfPath.replace("/storage", "")}`} target="_blank" rel="noreferrer" className="btn-ghost">
          <Download className="h-4 w-4" /> Download PDF
        </a>
      )}
    </div>
  );
}

function CoverPanel({ coverLetter, onGenerate, loading }: { coverLetter: string; onGenerate: () => void; loading: boolean }) {
  if (!coverLetter) {
    return (
      <div className="card grid place-items-center gap-3 p-10 text-center">
        <p className="text-slate-400">No cover letter yet.</p>
        <button onClick={onGenerate} disabled={loading} className="btn-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Generate cover letter
        </button>
      </div>
    );
  }
  return (
    <div className="card whitespace-pre-wrap p-6 text-sm leading-relaxed text-slate-200">{coverLetter}</div>
  );
}

function InterviewPanel({ prep, onGenerate, loading }: { prep: { q: string; tip: string }[]; onGenerate: () => void; loading: boolean }) {
  if (prep.length === 0) {
    return (
      <div className="card grid place-items-center gap-3 p-10 text-center">
        <p className="text-slate-400">Generate likely interview questions for this role.</p>
        <button onClick={onGenerate} disabled={loading} className="btn-primary">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessagesSquare className="h-4 w-4" />}
          Generate interview prep
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {prep.map((p, i) => (
        <div key={i} className="card p-4">
          <p className="font-medium text-white">{i + 1}. {p.q}</p>
          <p className="mt-1 text-sm text-slate-400">{p.tip}</p>
        </div>
      ))}
    </div>
  );
}

function OutreachPanel({
  job, caps, emailMode, onChanged,
}: {
  job: JobFull; caps: { smtp: boolean; ai: boolean }; emailMode: "review" | "auto"; onChanged: () => void;
}) {
  const [recruiterName, setRecruiterName] = useState("");
  const [recruiterEmail, setRecruiterEmail] = useState("");
  const [draft, setDraft] = useState<{ id: string; subject: string; body: string; recruiterEmail: string; status: string } | null>(
    job.outreach[0] || null
  );
  const [loading, setLoading] = useState("");
  const [msg, setMsg] = useState("");

  async function generate() {
    setLoading("gen");
    setMsg("");
    const res = await fetch(`/api/jobs/${job.id}/outreach`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recruiterName, recruiterEmail }),
    });
    const d = await res.json();
    setLoading("");
    if (!res.ok) return setMsg(d.error || "Failed");
    setDraft(d);
    setMsg(d.autoSent ? "Email auto-sent (auto mode)." : "Draft ready — review and send.");
    onChanged();
  }

  async function saveDraft() {
    if (!draft) return;
    setLoading("save");
    await fetch(`/api/outreach/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: draft.subject, body: draft.body, recruiterEmail: draft.recruiterEmail }),
    });
    setLoading("");
    setMsg("Saved.");
  }

  async function send() {
    if (!draft) return;
    setLoading("send");
    setMsg("");
    await saveDraftSilent();
    const res = await fetch(`/api/outreach/${draft.id}/send`, { method: "POST" });
    const d = await res.json();
    setLoading("");
    if (d.ok) {
      setDraft({ ...draft, status: "sent" });
      setMsg("Sent! 🎉");
      onChanged();
    } else {
      setMsg(d.error || "Send failed.");
    }
  }

  async function saveDraftSilent() {
    if (!draft) return;
    await fetch(`/api/outreach/${draft.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: draft.subject, body: draft.body, recruiterEmail: draft.recruiterEmail }),
    });
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="label">Recruiter name</label><input className="input" value={recruiterName} onChange={(e) => setRecruiterName(e.target.value)} placeholder="optional" /></div>
        <div><label className="label">Recruiter email</label><input className="input" value={recruiterEmail} onChange={(e) => setRecruiterEmail(e.target.value)} placeholder="name@company.com" /></div>
      </div>
      <button onClick={generate} disabled={loading === "gen"} className="btn-primary">
        {loading === "gen" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {caps.ai ? "Draft email with AI" : "Draft email"}
      </button>

      {draft && (
        <div className="space-y-3 border-t border-white/10 pt-4">
          <div>
            <label className="label">To</label>
            <input className="input" value={draft.recruiterEmail} onChange={(e) => setDraft({ ...draft, recruiterEmail: e.target.value })} placeholder="recruiter@company.com" />
          </div>
          <div>
            <label className="label">Subject</label>
            <input className="input" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} />
          </div>
          <div>
            <label className="label">Body</label>
            <textarea className="input h-48 resize-none" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={saveDraft} disabled={!!loading} className="btn-ghost">
              {loading === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save draft
            </button>
            <button onClick={send} disabled={!!loading || !caps.smtp || draft.status === "sent"} className="btn-primary" title={caps.smtp ? "" : "Configure SMTP in .env to send"}>
              {loading === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {draft.status === "sent" ? "Sent" : "Send email"}
            </button>
            <span className="text-xs text-slate-500">Mode: {emailMode}</span>
          </div>
          {!caps.smtp && <p className="text-xs text-amber-300">Add SMTP_USER & SMTP_PASSWORD to .env to send emails.</p>}
        </div>
      )}
      {msg && <p className="text-sm text-slate-300">{msg}</p>}
    </div>
  );
}

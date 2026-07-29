"use client";

import { useState } from "react";
import { AutofillData } from "@/lib/types";
import {
  Zap, Loader2, Download, ExternalLink, CheckCircle2, Copy, Check, Upload,
  FileText, Send, AlertTriangle, ClipboardList,
} from "lucide-react";

interface ApplyJob {
  id: string;
  title: string;
  company: string;
  url: string;
  source: string;
}

export default function ApplyKit({
  job,
  initialAutofill,
  initialSourceResumeMd,
  hasBaseResume,
  aiEnabled,
  automationEnabled,
  applicationStatus,
  onApplied,
  compact = false,
}: {
  job: ApplyJob;
  initialAutofill: AutofillData;
  initialSourceResumeMd: string;
  hasBaseResume: boolean;
  aiEnabled: boolean;
  automationEnabled: boolean;
  applicationStatus?: string;
  onApplied?: () => void;
  compact?: boolean;
}) {
  const [mode, setMode] = useState<"base" | "specific">(
    initialSourceResumeMd.trim() ? "specific" : "base"
  );
  const [specificResume, setSpecificResume] = useState(initialSourceResumeMd);
  const [autofill, setAutofill] = useState<AutofillData>(initialAutofill);

  const [loading, setLoading] = useState("");
  const [result, setResult] = useState<{
    pdfPath: string;
    coverLetter: string;
    tailored: boolean;
    notes: string[];
  } | null>(null);
  const [applied, setApplied] = useState(applicationStatus === "applied");
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  function flash(kind: "ok" | "err", msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 5000);
  }

  async function saveResumeChoice() {
    // Persist the chosen source resume (empty = use base resume).
    await fetch(`/api/jobs/${job.id}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceResumeMd: mode === "specific" ? specificResume : "" }),
    });
  }

  async function quickApply() {
    if (mode === "base" && !hasBaseResume && !specificResume.trim()) {
      flash("err", "No resume yet. Add a base resume in Profiles or paste a specific one here.");
      return;
    }
    setLoading("apply");
    setResult(null);
    try {
      await saveResumeChoice();
      const res = await fetch(`/api/jobs/${job.id}/quick-apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Quick apply failed");
      setAutofill(d.autofill);
      setResult({ pdfPath: d.resumePdfPath, coverLetter: d.coverLetter, tailored: d.tailored, notes: d.notes || [] });
      flash("ok", d.tailored ? "Ready! Resume tailored + autofill prepared." : "Ready! Resume + autofill prepared.");
      onApplied?.();
    } catch (e) {
      flash("err", e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading("");
    }
  }

  async function markApplied() {
    setLoading("mark");
    try {
      await fetch(`/api/jobs/${job.id}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "assisted" }),
      });
      setApplied(true);
      flash("ok", "Marked as applied 🎉");
      onApplied?.();
    } finally {
      setLoading("");
    }
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSpecificResume(String(reader.result || ""));
      setMode("specific");
    };
    reader.readAsText(file);
  }

  const pdfHref = result?.pdfPath ? `/api/storage${result.pdfPath.replace("/storage", "")}` : "";

  return (
    <div className="space-y-4">
      {/* Resume source */}
      <div>
        <div className="label flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Resume for this job</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMode("base")}
            className={`chip cursor-pointer ${mode === "base" ? "!border-brand-500/50 !bg-brand-500/15 text-brand-200" : ""}`}
          >
            Use base resume {!hasBaseResume && <span className="text-[10px] text-amber-300">none set</span>}
          </button>
          <button
            onClick={() => setMode("specific")}
            className={`chip cursor-pointer ${mode === "specific" ? "!border-brand-500/50 !bg-brand-500/15 text-brand-200" : ""}`}
          >
            Specific resume for this job
          </button>
        </div>
        {mode === "specific" && (
          <div className="mt-2 space-y-2">
            <label className="btn-ghost inline-flex cursor-pointer text-xs">
              <Upload className="h-3.5 w-3.5" /> Upload .txt/.md
              <input type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={onUpload} />
            </label>
            <textarea
              className="input h-40 resize-none font-mono text-xs"
              value={specificResume}
              onChange={(e) => setSpecificResume(e.target.value)}
              onBlur={saveResumeChoice}
              placeholder="Paste the resume you want to use specifically for this role. It becomes the source JobPilot tailors from (truthfully — it won't fabricate)."
            />
          </div>
        )}
      </div>

      {/* One-click apply */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={quickApply} disabled={!!loading} className="btn-primary">
          {loading === "apply" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {aiEnabled ? "Quick Apply — tailor + autofill" : "Quick Apply — prepare + autofill"}
        </button>
        {job.url && (
          <a href={job.url} target="_blank" rel="noreferrer" className="btn-ghost">
            <ExternalLink className="h-4 w-4" /> Open posting
          </a>
        )}
      </div>
      <p className="text-[11px] text-slate-500">
        One click tailors your resume to this JD, renders a PDF, drafts a cover letter, and fills the autofill kit below.
        You then submit on the employer&apos;s site (data pre-filled) or mark it applied.
      </p>

      {toast && (
        <div className={`rounded-lg px-3 py-2 text-sm ${toast.kind === "ok" ? "bg-emerald-500/10 text-emerald-200" : "bg-rose-500/10 text-rose-200"}`}>
          {toast.kind === "ok" ? <CheckCircle2 className="mr-2 inline h-4 w-4" /> : <AlertTriangle className="mr-2 inline h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Results: resume PDF + cover letter */}
      {result && (
        <div className="flex flex-wrap gap-2">
          {pdfHref && (
            <a href={pdfHref} target="_blank" rel="noreferrer" className="btn-ghost">
              <Download className="h-4 w-4" /> {result.tailored ? "Tailored resume PDF" : "Resume PDF"}
            </a>
          )}
          {result.coverLetter && <CopyButton label="Copy cover letter" value={result.coverLetter} />}
        </div>
      )}
      {result?.notes?.map((n, i) => (
        <p key={i} className="text-[11px] text-amber-300">{n}</p>
      ))}

      {/* Autofill kit */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="label mb-0 flex items-center gap-2"><ClipboardList className="h-3.5 w-3.5" /> Application autofill kit</div>
          <CopyButton label="Copy all" value={autofillAsText(autofill, job)} small />
        </div>
        <div className={`grid gap-2 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          <KitField label="Full name" value={autofill.fullName} />
          <KitField label="Email" value={autofill.email} />
          <KitField label="Phone" value={autofill.phone} />
          <KitField label="Location" value={autofill.location} />
          <KitField label="LinkedIn" value={autofill.linkedinUrl} />
          <KitField label="Portfolio" value={autofill.portfolioUrl} />
          <KitField label="Current title" value={autofill.currentTitle} />
          <KitField label="Years experience" value={autofill.yearsExperience} />
          <KitField label="Work authorization" value={autofill.workAuthorization} />
          <KitField label="Notice period" value={autofill.noticePeriod} />
          <KitField label="Expected salary" value={autofill.expectedSalary} />
          <KitField label="Willing to relocate" value={autofill.willingToRelocate} />
        </div>
        {autofill.topSkills.length > 0 && (
          <div className="mt-2">
            <div className="label flex items-center justify-between">
              <span>Top skills</span>
              <CopyButton label="Copy" value={autofill.topSkills.join(", ")} small />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {autofill.topSkills.map((s) => <span key={s} className="chip">{s}</span>)}
            </div>
          </div>
        )}
        {autofill.summary && (
          <div className="mt-2">
            <div className="label flex items-center justify-between">
              <span>Summary</span>
              <CopyButton label="Copy" value={autofill.summary} small />
            </div>
            <p className="text-sm text-slate-300">{autofill.summary}</p>
          </div>
        )}
        {isAutofillEmpty(autofill) && (
          <p className="text-[11px] text-slate-500">
            Tip: extract your details from your resume on the <span className="text-brand-300">Profiles</span> page, or run Quick Apply to populate this.
          </p>
        )}
      </div>

      {/* Apply actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <button onClick={markApplied} disabled={!!loading || applied} className="btn-ghost">
          {loading === "mark" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {applied ? "Applied ✓" : "Mark as applied"}
        </button>
        {job.url.includes("linkedin.com") && (
          <span className="text-[11px] text-amber-300">
            {automationEnabled ? "LinkedIn auto-apply available on the job page." : "Enable LinkedIn automation in Settings for auto-apply (ToS risk)."}
          </span>
        )}
      </div>
    </div>
  );
}

function KitField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{label}</span>
        {value ? <CopyButton value={value} small iconOnly /> : <span className="text-[10px] text-slate-600">—</span>}
      </div>
      <div className="truncate text-sm text-slate-200" title={value}>{value || "—"}</div>
    </div>
  );
}

function CopyButton({
  value, label, small, iconOnly,
}: { value: string; label?: string; small?: boolean; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <button
      onClick={copy}
      className={`inline-flex items-center gap-1 rounded-md text-slate-400 transition hover:text-white ${
        iconOnly ? "" : small ? "text-xs" : "btn-ghost"
      }`}
      title="Copy"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
      {!iconOnly && (label || "Copy")}
    </button>
  );
}

function isAutofillEmpty(a: AutofillData): boolean {
  return !a.fullName && !a.email && !a.phone && a.topSkills.length === 0 && !a.summary;
}

function autofillAsText(a: AutofillData, job: ApplyJob): string {
  const lines = [
    `Applying to: ${job.title} at ${job.company}`,
    a.fullName && `Name: ${a.fullName}`,
    a.email && `Email: ${a.email}`,
    a.phone && `Phone: ${a.phone}`,
    a.location && `Location: ${a.location}`,
    a.linkedinUrl && `LinkedIn: ${a.linkedinUrl}`,
    a.portfolioUrl && `Portfolio: ${a.portfolioUrl}`,
    a.currentTitle && `Current title: ${a.currentTitle}`,
    a.yearsExperience && `Years experience: ${a.yearsExperience}`,
    a.topSkills.length > 0 && `Skills: ${a.topSkills.join(", ")}`,
    a.workAuthorization && `Work authorization: ${a.workAuthorization}`,
    a.noticePeriod && `Notice period: ${a.noticePeriod}`,
    a.expectedSalary && `Expected salary: ${a.expectedSalary}`,
    a.willingToRelocate && `Willing to relocate: ${a.willingToRelocate}`,
    a.summary && `Summary: ${a.summary}`,
  ].filter(Boolean);
  return lines.join("\n");
}

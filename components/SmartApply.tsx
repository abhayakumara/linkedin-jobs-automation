"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AutofillData } from "@/lib/types";
import { MatchBadge, StatusBadge } from "./ui";
import ApplyKit from "./ApplyKit";
import {
  Rocket, Search, Loader2, Building2, MapPin, ChevronDown, ChevronUp, Zap, ExternalLink, Layers, FileArchive,
} from "lucide-react";

interface JobRow {
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
  application: { sourceResumeMd: string; status: string; resumePdfPath: string } | null;
}

interface SourceLite { id: string; label: string; requiresKey: boolean }

export default function SmartApply({
  initialJobs,
  sources,
  enabledSources,
  autofill,
  hasBaseResume,
  caps,
  automationEnabled,
}: {
  initialJobs: JobRow[];
  sources: SourceLite[];
  enabledSources: string[];
  autofill: AutofillData;
  hasBaseResume: boolean;
  caps: { ai: boolean; aiProvider?: string };
  automationEnabled: boolean;
}) {
  const router = useRouter();
  const [jobs] = useState(initialJobs);
  const [selectedSources, setSelectedSources] = useState<string[]>(enabledSources);
  const [discovering, setDiscovering] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [minMatch, setMinMatch] = useState(0);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [unappliedOnly, setUnappliedOnly] = useState(false);

  // Batch "Quick Apply to all ≥ X%"
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchMsg, setBatchMsg] = useState("");
  const [includeCover, setIncludeCover] = useState(false);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (remoteOnly && !j.remote) return false;
      if (unappliedOnly && j.status === "applied") return false;
      if ((j.matchScore ?? 0) < minMatch) return false;
      if (query) {
        const hay = `${j.title} ${j.company} ${j.location}`.toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [jobs, query, minMatch, remoteOnly, unappliedOnly]);

  // Jobs the batch will prepare: everything currently shown that isn't applied yet.
  const batchEligible = useMemo(() => filtered.filter((j) => j.status !== "applied"), [filtered]);
  // Shown jobs that already have a tailored PDF (zip download candidates).
  const withPdf = useMemo(() => filtered.filter((j) => j.application?.resumePdfPath), [filtered]);

  const [zipping, setZipping] = useState(false);
  async function downloadZip() {
    if (withPdf.length === 0) return;
    setZipping(true);
    setBatchMsg("");
    try {
      const res = await fetch("/api/jobs/zip-resumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: withPdf.map((j) => j.id) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setBatchMsg(d.error || "Could not build the zip.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `JobPilot-resumes-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setBatchMsg(e instanceof Error ? e.message : "Could not build the zip.");
    } finally {
      setZipping(false);
    }
  }

  async function batchApply() {
    if (batchEligible.length === 0) return;
    setBatchRunning(true);
    setBatchMsg("");
    try {
      const res = await fetch("/api/jobs/batch-quick-apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds: batchEligible.map((j) => j.id), coverLetter: includeCover }),
      });
      const d = await res.json();
      if (!res.ok) {
        setBatchMsg(d.error || "Batch failed.");
      } else {
        const failed = (d.results || []).filter((r: { ok: boolean }) => !r.ok).length;
        const capNote = d.skipped > 0 ? ` — ${d.skipped} over the ${d.cap}/run cap, run again for the rest` : "";
        setBatchMsg(
          `Prepared ${d.prepared} of ${d.processed} job${d.processed === 1 ? "" : "s"}${capNote}.` +
            (failed ? ` ${failed} failed.` : " Resumes tailored + autofill ready — open each to submit.")
        );
        router.refresh();
      }
    } catch (e) {
      setBatchMsg(e instanceof Error ? e.message : "Batch failed.");
    } finally {
      setBatchRunning(false);
    }
  }

  async function discover() {
    setDiscovering(true);
    setMessage("");
    try {
      const res = await fetch("/api/jobs/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: selectedSources }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Discovery failed.");
      } else {
        const errs = (data.errors || []).map((e: { source: string; message: string }) => `${e.source}: ${e.message}`);
        setMessage(
          `Found ${data.found}, added ${data.added} new, scored ${data.scored}.` +
            (errs.length ? ` Issues — ${errs.join("; ")}` : "")
        );
        router.refresh();
      }
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Discovery failed.");
    } finally {
      setDiscovering(false);
    }
  }

  function toggleSource(id: string) {
    setSelectedSources((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Smart Apply ⚡</h1>
          <p className="mt-1 text-sm text-slate-400">
            One place to search every source for roles that fit your skills, then apply in one click with autofill.
          </p>
        </div>
        <button onClick={discover} disabled={discovering || selectedSources.length === 0} className="btn-primary">
          {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          {discovering ? "Searching…" : "Search all jobs"}
        </button>
      </div>

      {!hasBaseResume && (
        <div className="card border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
          Add a base resume (and extract your details) on the{" "}
          <Link href="/profiles" className="underline">Profiles</Link> page so Quick Apply can tailor and autofill.
        </div>
      )}

      {/* sources */}
      <div className="card p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Sources to search</div>
        <div className="flex flex-wrap gap-2">
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleSource(s.id)}
              className={`chip cursor-pointer ${selectedSources.includes(s.id) ? "!border-brand-500/50 !bg-brand-500/15 text-brand-200" : ""}`}
            >
              {s.label}{s.requiresKey && <span className="text-[10px] text-amber-300">key</span>}
            </button>
          ))}
        </div>
        {message && <p className="mt-3 text-sm text-slate-300">{message}</p>}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search title, company, location…" className="input pl-9" />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} className="accent-brand-500" /> Remote only
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={unappliedOnly} onChange={(e) => setUnappliedOnly(e.target.checked)} className="accent-brand-500" /> Hide applied
        </label>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Min match {minMatch}%
          <input type="range" min={0} max={100} step={5} value={minMatch} onChange={(e) => setMinMatch(Number(e.target.value))} className="accent-brand-500" />
        </label>
      </div>

      {/* batch quick-apply */}
      <div className="card flex flex-wrap items-center justify-between gap-3 border-brand-500/25 bg-brand-500/[0.05] p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-100">
            <Layers className="h-4 w-4" /> Batch Quick Apply
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Prepares (tailors resume + PDF + autofill) every shown job ≥ {minMatch}% that isn&apos;t applied yet —{" "}
            <span className="font-medium text-brand-200">{batchEligible.length}</span> job{batchEligible.length === 1 ? "" : "s"}.
            Adjust the “Min match” slider above to raise the bar. Up to 25 per run.
          </p>
          {batchMsg && <p className="mt-1 text-xs text-slate-300">{batchMsg}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-400" title="Slower — one AI draft per job">
            <input type="checkbox" checked={includeCover} onChange={(e) => setIncludeCover(e.target.checked)} className="accent-brand-500" />
            Cover letters
          </label>
          <button
            onClick={downloadZip}
            disabled={zipping || withPdf.length === 0}
            className="btn-ghost"
            title={withPdf.length ? "Download all tailored resume PDFs as a zip" : "No tailored PDFs yet — run Quick Apply first"}
          >
            {zipping ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />}
            {zipping ? "Zipping…" : `Download PDFs (${withPdf.length})`}
          </button>
          <button onClick={batchApply} disabled={batchRunning || batchEligible.length === 0} className="btn-primary">
            {batchRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {batchRunning ? "Preparing…" : `Quick Apply — ${batchEligible.length} ≥ ${minMatch}%`}
          </button>
        </div>
      </div>

      {/* list */}
      {filtered.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center text-slate-400">
          No jobs match. Hit <span className="mx-1 font-medium text-brand-300">Search all jobs</span> to discover roles for your profile.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((j) => {
            const open = expanded === j.id;
            return (
              <div key={j.id} className={`card ${open ? "!border-brand-500/40" : "card-hover"}`}>
                <div className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold">{j.title}</h3>
                      {j.remote && <span className="chip !border-emerald-500/30 text-emerald-300">remote</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{j.company || "—"}</span>
                      {j.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{j.location}</span>}
                      {j.salary && <span className="text-emerald-300">{j.salary}</span>}
                      <span className="chip">{j.source}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <MatchBadge score={j.matchScore} />
                    <StatusBadge status={j.status} />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-2">
                  <button onClick={() => setExpanded(open ? null : j.id)} className="btn-primary py-1.5 text-sm">
                    <Zap className="h-4 w-4" /> {open ? "Close" : "Apply"}
                    {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <Link href={`/jobs/${j.id}`} className="btn-ghost py-1.5 text-sm">Details</Link>
                  {j.url && (
                    <a href={j.url} target="_blank" rel="noreferrer" className="btn-ghost py-1.5 text-sm">
                      <ExternalLink className="h-4 w-4" /> Posting
                    </a>
                  )}
                </div>
                {open && (
                  <div className="border-t border-white/10 p-4">
                    <ApplyKit
                      job={{ id: j.id, title: j.title, company: j.company, url: j.url, source: j.source }}
                      initialAutofill={autofill}
                      initialSourceResumeMd={j.application?.sourceResumeMd || ""}
                      hasBaseResume={hasBaseResume}
                      aiEnabled={caps.ai}
                      automationEnabled={automationEnabled}
                      applicationStatus={j.status}
                      onApplied={() => router.refresh()}
                      compact
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

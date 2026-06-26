"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MatchBadge, StatusBadge } from "./ui";
import { Rocket, Plus, Search, MapPin, Building2, Loader2, X } from "lucide-react";

interface JobLite {
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
  application: { id: string } | null;
}

interface SourceLite {
  id: string;
  label: string;
  requiresKey: boolean;
}

export default function JobsBoard({
  initialJobs,
  sources,
  enabledSources,
  roles,
}: {
  initialJobs: JobLite[];
  sources: SourceLite[];
  enabledSources: string[];
  roles: string[];
}) {
  const router = useRouter();
  const [jobs] = useState(initialJobs);
  const [selectedSources, setSelectedSources] = useState<string[]>(enabledSources);
  const [discovering, setDiscovering] = useState(false);
  const [message, setMessage] = useState("");
  const [showManual, setShowManual] = useState(false);

  // filters
  const [query, setQuery] = useState("");
  const [minMatch, setMinMatch] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if ((j.matchScore ?? 0) < minMatch) return false;
      if (query) {
        const hay = `${j.title} ${j.company} ${j.location}`.toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [jobs, query, minMatch, statusFilter]);

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
          <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
          <p className="mt-1 text-sm text-slate-400">
            Targeting {roles.join(", ") || "— set roles in Profiles"}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowManual(true)} className="btn-ghost">
            <Plus className="h-4 w-4" /> Add manually
          </button>
          <button onClick={discover} disabled={discovering || selectedSources.length === 0} className="btn-primary">
            {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
            {discovering ? "Discovering…" : "Discover jobs"}
          </button>
        </div>
      </div>

      {/* sources */}
      <div className="card p-4">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Sources</div>
        <div className="flex flex-wrap gap-2">
          {sources.map((s) => (
            <button
              key={s.id}
              onClick={() => toggleSource(s.id)}
              className={`chip cursor-pointer ${
                selectedSources.includes(s.id)
                  ? "!border-brand-500/50 !bg-brand-500/15 text-brand-200"
                  : ""
              }`}
            >
              {s.label}
              {s.requiresKey && <span className="text-[10px] text-amber-300">key</span>}
            </button>
          ))}
        </div>
        {message && <p className="mt-3 text-sm text-slate-300">{message}</p>}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, company, location…"
            className="input pl-9"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input w-auto">
          <option value="all">All statuses</option>
          {["discovered", "shortlisted", "tailored", "applied", "interview", "offer", "rejected", "skipped"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Min match {minMatch}%
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={minMatch}
            onChange={(e) => setMinMatch(Number(e.target.value))}
            className="accent-brand-500"
          />
        </label>
      </div>

      {/* list */}
      {filtered.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center text-slate-400">
          No jobs match. Hit <span className="mx-1 font-medium text-brand-300">Discover jobs</span> or add one manually.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((j) => (
            <Link key={j.id} href={`/jobs/${j.id}`} className="card card-hover block p-4">
              <div className="flex items-start justify-between gap-4">
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
            </Link>
          ))}
        </div>
      )}

      {showManual && <ManualJobModal onClose={() => setShowManual(false)} onAdded={() => { setShowManual(false); router.refresh(); }} />}
    </div>
  );
}

function ManualJobModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [form, setForm] = useState({ title: "", company: "", location: "", url: "", descriptionText: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/jobs/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) setError(data.error || "Failed to add job.");
    else onAdded();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Add a job manually</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          Paste a job you found anywhere (incl. LinkedIn). JobPilot will score it and let you tailor a resume.
        </p>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Title *</label><input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><label className="label">Company</label><input className="input" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Location</label><input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
            <div><label className="label">URL</label><input className="input" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://…" /></div>
          </div>
          <div>
            <label className="label">Job description *</label>
            <textarea className="input h-40 resize-none" value={form.descriptionText} onChange={(e) => setForm({ ...form, descriptionText: e.target.value })} placeholder="Paste the full job description here…" />
          </div>
          {error && <p className="text-sm text-rose-400">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={save} disabled={saving || !form.title || !form.descriptionText} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add job
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AutofillData } from "@/lib/types";
import { MatchBadge, StatusBadge } from "./ui";
import ApplyKit from "./ApplyKit";
import {
  Rocket, Search, Loader2, Building2, MapPin, ChevronDown, ChevronUp,
  Zap, ExternalLink, Lightbulb, CheckCircle2, AlertTriangle,
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

interface ResumeTips {
  present: string[];
  missing: string[];
  tips: string[];
}

interface PortalLink {
  id: string;
  name: string;
  tagline: string;
  url: string;
}

export default function IndiaJobs({
  initialJobs,
  portals,
  keywords,
  autofill,
  hasBaseResume,
  caps,
  automationEnabled,
  hasAdzuna,
}: {
  initialJobs: JobRow[];
  portals: PortalLink[];
  keywords: string[];
  autofill: AutofillData;
  hasBaseResume: boolean;
  caps: { ai: boolean; aiProvider?: string };
  automationEnabled: boolean;
  hasAdzuna: boolean;
}) {
  const router = useRouter();
  const [jobs] = useState(initialJobs);
  const [discovering, setDiscovering] = useState(false);
  const [message, setMessage] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tipsOpen, setTipsOpen] = useState<string | null>(null);
  const [tipsData, setTipsData] = useState<Record<string, ResumeTips>>({});
  const [tipsLoading, setTipsLoading] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [minMatch, setMinMatch] = useState(0);
  const [remoteOnly, setRemoteOnly] = useState(false);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (remoteOnly && !j.remote) return false;
      if ((j.matchScore ?? 0) < minMatch) return false;
      if (query) {
        const hay = `${j.title} ${j.company} ${j.location}`.toLowerCase();
        if (!hay.includes(query.toLowerCase())) return false;
      }
      return true;
    });
  }, [jobs, query, minMatch, remoteOnly]);

  async function discover() {
    setDiscovering(true);
    setMessage("");
    try {
      const res = await fetch("/api/jobs/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: ["adzuna"], country: "in", limitPerSource: 25 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Discovery failed.");
      } else {
        const errs = (data.errors || []).map(
          (e: { source: string; message: string }) => `${e.source}: ${e.message}`
        );
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

  async function loadTips(jobId: string) {
    if (tipsData[jobId]) {
      setTipsOpen(tipsOpen === jobId ? null : jobId);
      return;
    }
    setTipsLoading(jobId);
    setTipsOpen(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/resume-tips`);
      const data = await res.json();
      if (res.ok) {
        setTipsData((prev) => ({ ...prev, [jobId]: data }));
      }
    } catch {
      /* ignore */
    } finally {
      setTipsLoading(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jobs — India 🇮🇳</h1>
          <p className="mt-1 text-sm text-slate-400">
            Search Indian job portals, get resume tips, and apply with your tailored kit.
          </p>
        </div>
        {hasAdzuna && (
          <button onClick={discover} disabled={discovering} className="btn-primary">
            {discovering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="h-4 w-4" />
            )}
            {discovering ? "Searching…" : "Discover India jobs"}
          </button>
        )}
      </div>

      {!hasBaseResume && (
        <div className="card border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
          Add a base resume on the{" "}
          <Link href="/profiles" className="underline">
            Profiles
          </Link>{" "}
          page so resume tips and tailoring can work.
        </div>
      )}

      {/* Portal quick-search links */}
      <div className="card p-4">
        <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
          Search on Indian portals
        </div>
        <p className="mb-3 text-xs text-slate-500">
          Pre-filled with your target roles:{" "}
          <span className="text-slate-300">{keywords.join(", ") || "set roles in Profiles"}</span>
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {portals.map((p) => (
            <a
              key={p.id}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="card card-hover flex items-center gap-3 px-3 py-2.5"
            >
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-500/15 text-sm font-bold text-brand-300">
                {p.name.charAt(0)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="truncate text-[11px] text-slate-500">{p.tagline}</div>
              </div>
              <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-600" />
            </a>
          ))}
        </div>
      </div>

      {/* Adzuna India discover */}
      {!hasAdzuna && (
        <div className="card border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
          Set <code className="rounded bg-black/30 px-1">ADZUNA_APP_ID</code> and{" "}
          <code className="rounded bg-black/30 px-1">ADZUNA_APP_KEY</code> in{" "}
          <code className="rounded bg-black/30 px-1">.env</code> to discover jobs from
          Adzuna India (free API key). Without it, use the portal links above to browse
          directly.
        </div>
      )}
      {message && (
        <p className="text-sm text-slate-300">{message}</p>
      )}

      {/* Filters */}
      {jobs.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, company, location…"
              className="input pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={remoteOnly}
              onChange={(e) => setRemoteOnly(e.target.checked)}
              className="accent-brand-500"
            />{" "}
            Remote only
          </label>
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
      )}

      {/* Job list */}
      {filtered.length === 0 && jobs.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center text-slate-400">
          {hasAdzuna ? (
            <>
              No India jobs discovered yet. Hit{" "}
              <span className="mx-1 font-medium text-brand-300">Discover India jobs</span> or
              browse the portal links above.
            </>
          ) : (
            <>
              Use the portal links above to search Indian job sites, or configure Adzuna to
              discover jobs here.
            </>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card grid place-items-center px-6 py-10 text-center text-slate-400">
          No jobs match your filters.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((j) => {
            const applyOpen = expanded === j.id;
            const tipOpen = tipsOpen === j.id;
            const tips = tipsData[j.id];
            return (
              <div
                key={j.id}
                className={`card ${applyOpen ? "!border-brand-500/40" : "card-hover"}`}
              >
                <div className="flex items-start justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold">{j.title}</h3>
                      {j.remote && (
                        <span className="chip !border-emerald-500/30 text-emerald-300">
                          remote
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        {j.company || "—"}
                      </span>
                      {j.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {j.location}
                        </span>
                      )}
                      {j.salary && (
                        <span className="text-emerald-300">{j.salary}</span>
                      )}
                      <span className="chip">{j.source}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <MatchBadge score={j.matchScore} />
                    <StatusBadge status={j.status} />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-2">
                  <button
                    onClick={() => setExpanded(applyOpen ? null : j.id)}
                    className="btn-primary py-1.5 text-sm"
                  >
                    <Zap className="h-4 w-4" /> {applyOpen ? "Close" : "Apply"}
                    {applyOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => loadTips(j.id)}
                    disabled={tipsLoading === j.id}
                    className="btn-ghost py-1.5 text-sm"
                  >
                    {tipsLoading === j.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Lightbulb className="h-4 w-4" />
                    )}
                    Resume Tips
                    {tipOpen && !tipsLoading ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  <Link href={`/jobs/${j.id}`} className="btn-ghost py-1.5 text-sm">
                    Details
                  </Link>
                  {j.url && (
                    <a
                      href={j.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost py-1.5 text-sm"
                    >
                      <ExternalLink className="h-4 w-4" /> Posting
                    </a>
                  )}
                </div>

                {/* Resume tips panel */}
                {tipOpen && (
                  <div className="border-t border-white/10 p-4">
                    {tipsLoading === j.id ? (
                      <div className="flex items-center gap-2 text-sm text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> Analyzing keywords…
                      </div>
                    ) : tips ? (
                      <div className="space-y-3">
                        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                          Resume vs. JD keyword analysis
                        </div>

                        {tips.present.length > 0 && (
                          <div>
                            <div className="mb-1 flex items-center gap-1.5 text-xs text-emerald-300">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Keywords you already have
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {tips.present.map((k) => (
                                <span
                                  key={k}
                                  className="chip !border-emerald-500/30 !bg-emerald-500/10 text-emerald-300"
                                >
                                  {k}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {tips.missing.length > 0 && (
                          <div>
                            <div className="mb-1 flex items-center gap-1.5 text-xs text-amber-300">
                              <AlertTriangle className="h-3.5 w-3.5" /> Missing keywords — add
                              these
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {tips.missing.map((k) => (
                                <span
                                  key={k}
                                  className="chip !border-amber-500/30 !bg-amber-500/10 text-amber-300"
                                >
                                  {k}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {tips.tips.length > 0 && (
                          <div>
                            <div className="mb-1 text-xs font-medium text-slate-400">
                              How to improve your resume for this role
                            </div>
                            <ul className="space-y-1">
                              {tips.tips.map((t, i) => (
                                <li key={i} className="text-sm text-slate-300">
                                  <span className="mr-1.5 text-brand-400">•</span>
                                  {t}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {caps.ai && (
                          <p className="text-[11px] text-slate-500">
                            Want AI to do this for you? Expand &quot;Apply&quot; and hit Quick
                            Apply — it tailors your resume automatically.
                          </p>
                        )}
                        {!caps.ai && (
                          <p className="text-[11px] text-slate-500">
                            These are heuristic tips based on keyword overlap. Configure an AI
                            provider in .env for automatic resume tailoring.
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">Could not load tips.</p>
                    )}
                  </div>
                )}

                {/* Apply drawer */}
                {applyOpen && (
                  <div className="border-t border-white/10 p-4">
                    <ApplyKit
                      job={{
                        id: j.id,
                        title: j.title,
                        company: j.company,
                        url: j.url,
                        source: j.source,
                      }}
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

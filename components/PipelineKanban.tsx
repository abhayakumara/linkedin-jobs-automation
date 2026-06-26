"use client";

import { useState } from "react";
import Link from "next/link";
import { PIPELINE_COLUMNS, STATUS_LABELS } from "@/lib/types";
import { PageHeader } from "./ui";

interface KJob {
  id: string;
  title: string;
  company: string;
  status: string;
  matchScore: number | null;
}

const COL_ACCENT: Record<string, string> = {
  discovered: "border-t-slate-400",
  shortlisted: "border-t-sky-400",
  tailored: "border-t-violet-400",
  applied: "border-t-brand-500",
  interview: "border-t-amber-400",
  offer: "border-t-emerald-400",
  rejected: "border-t-rose-400",
};

export default function PipelineKanban({ initialJobs }: { initialJobs: KJob[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  async function move(id: string, status: string) {
    const job = jobs.find((j) => j.id === id);
    if (!job || job.status === status) return;
    setJobs((js) => js.map((j) => (j.id === id ? { ...j, status } : j)));
    await fetch(`/api/jobs/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
  }

  return (
    <div>
      <PageHeader title="Pipeline" subtitle="Drag cards across stages to track every application." />
      <div className="flex gap-3 overflow-x-auto pb-4">
        {PIPELINE_COLUMNS.map((col) => {
          const colJobs = jobs.filter((j) => j.status === col);
          return (
            <div
              key={col}
              onDragOver={(e) => { e.preventDefault(); setOverCol(col); }}
              onDragLeave={() => setOverCol((c) => (c === col ? null : c))}
              onDrop={() => { if (dragId) move(dragId, col); setDragId(null); setOverCol(null); }}
              className={`flex w-64 shrink-0 flex-col rounded-2xl border border-t-2 border-white/10 bg-white/[0.03] p-2 ${COL_ACCENT[col]} ${
                overCol === col ? "ring-2 ring-brand-500/40" : ""
              }`}
            >
              <div className="flex items-center justify-between px-2 py-2">
                <span className="text-sm font-semibold">{STATUS_LABELS[col]}</span>
                <span className="chip">{colJobs.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {colJobs.map((j) => (
                  <div
                    key={j.id}
                    draggable
                    onDragStart={() => setDragId(j.id)}
                    onDragEnd={() => setDragId(null)}
                    className="card card-hover cursor-grab p-3 active:cursor-grabbing"
                  >
                    <Link href={`/jobs/${j.id}`} className="block">
                      <div className="truncate text-sm font-medium">{j.title}</div>
                      <div className="mt-0.5 truncate text-xs text-slate-400">{j.company}</div>
                      {j.matchScore !== null && (
                        <div className="mt-1 text-xs font-semibold text-brand-300">{j.matchScore}% match</div>
                      )}
                    </Link>
                  </div>
                ))}
                {colJobs.length === 0 && (
                  <div className="px-2 py-6 text-center text-xs text-slate-600">Drop here</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

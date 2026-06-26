import { STATUS_LABELS } from "@/lib/types";

export function MatchBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined)
    return <span className="chip text-slate-400">unscored</span>;
  const color =
    score >= 75
      ? "!border-emerald-500/40 !bg-emerald-500/15 text-emerald-300"
      : score >= 50
        ? "!border-amber-500/40 !bg-amber-500/15 text-amber-300"
        : "!border-rose-500/40 !bg-rose-500/15 text-rose-300";
  return <span className={`chip font-semibold ${color}`}>{score}% match</span>;
}

const STATUS_COLORS: Record<string, string> = {
  discovered: "!bg-slate-500/15 text-slate-300 !border-slate-500/30",
  shortlisted: "!bg-sky-500/15 text-sky-300 !border-sky-500/30",
  tailored: "!bg-violet-500/15 text-violet-300 !border-violet-500/30",
  applied: "!bg-brand-500/15 text-brand-300 !border-brand-500/30",
  interview: "!bg-amber-500/15 text-amber-300 !border-amber-500/30",
  offer: "!bg-emerald-500/15 text-emerald-300 !border-emerald-500/30",
  rejected: "!bg-rose-500/15 text-rose-300 !border-rose-500/30",
  skipped: "!bg-zinc-500/15 text-zinc-400 !border-zinc-500/30",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`chip ${STATUS_COLORS[status] || ""}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="card grid place-items-center px-6 py-16 text-center">
      <p className="text-slate-300">{title}</p>
      {hint && <p className="mt-1 max-w-md text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

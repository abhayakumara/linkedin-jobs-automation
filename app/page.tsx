import Link from "next/link";
import { prisma } from "@/lib/db";
import { getActiveProfile } from "@/lib/profile";
import { capabilities } from "@/lib/settings";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui";
import { PipelineChart } from "@/components/PipelineChart";
import { Briefcase, Send, Mail, Sparkles, ArrowRight, Rocket, Globe } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await getActiveProfile();
  const caps = capabilities();

  if (!profile) {
    return (
      <div>
        <PageHeader title="Welcome to JobPilot ✈️" subtitle="Your AI job-application autopilot." />
        <EmptyState
          title="Create your first profile to get started"
          hint="Add your target roles and a base resume, then JobPilot will discover, tailor, and help you apply."
        />
        <div className="mt-4">
          <Link href="/profiles" className="btn-primary">
            Create a profile <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  const pid = profile.raw.id;
  const [total, applied, interview, offers, outreachSent, recent, byStatus, indiaCount] = await Promise.all([
    prisma.job.count({ where: { profileId: pid } }),
    prisma.job.count({ where: { profileId: pid, status: "applied" } }),
    prisma.job.count({ where: { profileId: pid, status: "interview" } }),
    prisma.job.count({ where: { profileId: pid, status: "offer" } }),
    prisma.outreach.count({ where: { status: "sent" } }),
    prisma.job.findMany({
      where: { profileId: pid },
      orderBy: [{ matchScore: "desc" }, { fetchedAt: "desc" }],
      take: 5,
    }),
    prisma.job.groupBy({ by: ["status"], where: { profileId: pid }, _count: true }),
    prisma.job.count({ where: { profileId: pid, indiaRemote: true } }),
  ]);

  const statusCounts: Record<string, number> = {};
  byStatus.forEach((s) => (statusCounts[s.status] = s._count));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Hi, ${profile.raw.name.split(" ")[0]} 👋`}
        subtitle={`Targeting: ${profile.targetRoles.join(", ") || "set your roles in Profiles"}`}
      >
        <Link href="/jobs" className="btn-primary">
          <Rocket className="h-4 w-4" /> Discover jobs
        </Link>
      </PageHeader>

      {!caps.ai && (
        <div className="card border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
          <Sparkles className="mr-2 inline h-4 w-4" />
          Add an <code className="rounded bg-black/30 px-1">ANTHROPIC_API_KEY</code> to your{" "}
          <code className="rounded bg-black/30 px-1">.env</code> to unlock AI resume tailoring, cover
          letters, and high-quality match scoring. (A keyword heuristic is used meanwhile.)
        </div>
      )}

      <Link
        href="/remote-india"
        className="card card-hover flex items-center justify-between px-4 py-3 text-sm"
      >
        <span className="flex items-center gap-2 text-slate-200">
          <Globe className="h-4 w-4 text-brand-400" />
          🇮🇳 Remote jobs workable from India
        </span>
        <span className="flex items-center gap-2 text-slate-400">
          <span className="font-semibold text-brand-300">{indiaCount}</span> tracked
          <ArrowRight className="h-4 w-4" />
        </span>
      </Link>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Jobs tracked" value={total} icon={Briefcase} href="/jobs" />
        <Stat label="Applied" value={applied} icon={Send} href="/applications" />
        <Stat label="Interviews" value={interview} icon={Sparkles} href="/applications" />
        <Stat label="Emails sent" value={outreachSent} icon={Mail} href="/outreach" />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="card p-5 lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold text-slate-300">Pipeline</h2>
          <PipelineChart data={statusCounts} />
        </div>

        <div className="card p-5 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-300">Top matches</h2>
            <Link href="/jobs" className="text-xs text-brand-300 hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No jobs yet — head to Jobs and hit Discover.
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((j) => (
                <li key={j.id}>
                  <Link
                    href={`/jobs/${j.id}`}
                    className="card card-hover flex items-center justify-between px-3 py-2"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{j.title}</span>
                      <span className="block truncate text-xs text-slate-400">{j.company}</span>
                    </span>
                    <span className="ml-2 shrink-0 text-sm font-semibold text-brand-300">
                      {j.matchScore ?? "—"}
                      {j.matchScore !== null && "%"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(statusCounts).map(([s, c]) => (
          <span key={s} className="inline-flex items-center gap-2">
            <StatusBadge status={s} />
            <span className="text-xs text-slate-400">{c}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}) {
  return (
    <Link href={href} className="card card-hover p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
        <Icon className="h-4 w-4 text-brand-400" />
      </div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </Link>
  );
}
